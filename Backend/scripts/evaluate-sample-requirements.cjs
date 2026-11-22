// Solo lectura en la copia autorizada; reutiliza rankings, sin llamar a Ollama.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {parseQuery,filterCandidates,validate}=require('../src/services/search-requirements.lab');
const {prepareChurch}=require('../src/services/church-embedding-document.lab');
const sha=s=>createHash('sha256').update(s).digest('hex');
const criterion=(field,value,polarity='include')=>({field,value,polarity});
// Criterios fijados manualmente para evaluar el validador, no la extracción automática.
const explicit={courses:[criterion('community.activities','Cursos / institutos'),criterion('community.activities','Conferencias')],sports:[criterion('community.activities','Actividades deportivas')],liturgy:[criterion('doctrine.characteristics','Culto litúrgico'),criterion('doctrine.characteristics','Eucaristía')],streaming:[criterion('community.ministries','Streaming'),criterion('location.commune','Ñuñoa')],baptism:[criterion('doctrine.characteristics','Bautismo de creyentes')]};
async function main(){
 if(process.argv.slice(2).some(a=>a!=='--public-dns'))throw Error('INVALID_ARGUMENT');if(process.argv.includes('--public-dns'))require('node:dns').setServers(['1.1.1.1']);
 const directory=path.resolve(__dirname,'../../outputs/church-embeddings-local'),sampleFile='sample-vectors-2026-11-18T05-21-16-806Z.json',rankingFile='query-report-2026-11-18T05-28-45-499Z.json';
 const raw=await fs.readFile(path.join(directory,sampleFile),'utf8'),sample=JSON.parse(raw),ranking=JSON.parse(await fs.readFile(path.join(directory,rankingFile),'utf8'));
 if(ranking.sourceHash!==sha(raw))throw Error('RANKING_SOURCE_MISMATCH');
 const ids=[...new Set(sample.items.map(d=>d.churchId))];if(ids.length!==5||ids.some(id=>! /^[a-f0-9]{24}$/.test(id)))throw Error('INVALID_SAMPLE');
 const database='koinonia_synthetic_test_v2_local',env=require('dotenv').parse(await fs.readFile(path.resolve(__dirname,'../.env'),'utf8')),uri=env.MONGO_URI;
 if(!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri)||decodeURIComponent(uri.slice(uri.indexOf('://')+3).split('/').slice(1).join('/').split('?')[0])!==database)throw Error('DATABASE_NOT_AUTHORIZED');
 const {MongoClient,ObjectId}=require('mongoose').mongo,client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,socketTimeoutMS:30000});
 let churches;try{
  await client.connect();churches=await client.db(database).collection('churches').find({_id:{$in:ids.map(id=>new ObjectId(id))}},{projection:{_id:1,active:1,mergedInto:1,metadata:1,'importInfo.batchId':1,privateFields:1,identification:1,christianIdentity:1,doctrine:1,community:1,'location.commune':1,'location.city':1,'location.region':1,'location.accessibilityDetails':1,updatedAt:1}}).toArray();
 }finally{await client.close();}
 const current=new Map(churches.flatMap(prepareChurch).map(d=>[d._id,d])),original=new Map(sample.items.map(d=>[d._id,d]));
 const stale=sample.items.filter(d=>current.get(d._id)?.textHash!==d.textHash).map(d=>d._id),rows=[];
 for(const query of ranking.rows){
  const candidates=query.ranking.filter(r=>!stale.includes(r.id)).map(r=>{const source=original.get(r.id);if(!source)throw Error('UNKNOWN_RANKING_DOCUMENT');return {churchId:source.churchId,title:source.title,score:r.score,fragmentId:r.id};});
  const automatic=parseQuery(query.text),modes=[['automatic',automatic]];
  if(explicit[query.id])modes.push(['manual_structured',validate({criteria:explicit[query.id],unresolved:[]})]);
  for(const [mode,request] of modes){const result=filterCandidates(candidates,churches,request);rows.push({queryId:query.id,text:query.text,mode,request,...result});}
 }
 const createdAt=new Date().toISOString(),stamp=createdAt.replace(/[:.]/g,'-'),summary=rows.map(r=>({query:r.queryId,mode:r.mode,accepted:r.accepted.map(c=>c.title),held:r.held.reduce((a,c)=>(a[c.validation.status]=(a[c.validation.status]||0)+1,a),{})}));
 const report={createdAt,database,sampleFile,rankingFile,churchesRead:churches.length,staleFragments:stale,summary,rows};
 await fs.writeFile(path.join(directory,'requirements-report-'+stamp+'.json'),JSON.stringify(report,null,2)+'\n');
 const lines=['# Validación de la muestra','',`Fichas actuales leídas: ${churches.length}. Fragmentos retirados del ranking por cambios o visibilidad: ${stale.length}.`,'','Modo automático: gramática actual. Modo manual estructurado: criterios fijados explícitamente; no demuestra extracción automática. Sin regenerar embeddings ni escribir en MongoDB. La compatibilidad expresa lo declarado en las fichas, no verificación externa.',''];
 for(const row of rows){lines.push('## '+row.queryId+' — '+row.mode,'',row.text,'','Aceptadas: '+(row.accepted.map(c=>c.title).join('; ')||'ninguna'),'',...row.held.map(c=>'- '+c.title+': '+c.validation.status+(c.validation.requirements?.length?' ('+c.validation.requirements.map(r=>r.field+': '+r.status).join('; ')+')':'')),'');}
 await fs.writeFile(path.join(directory,'requirements-review-'+stamp+'.md'),lines.join('\n'));
 console.log(JSON.stringify({report:'requirements-report-'+stamp+'.json',churchesRead:churches.length,staleFragments:stale.length,summary}));
}
main().catch(e=>{console.error(JSON.stringify({name:e.name,code:e.code||null,reason:/^[A-Z_]+$/.test(e.message)?e.message:'SAMPLE_REQUIREMENTS_FAILED'}));process.exitCode=1;});
