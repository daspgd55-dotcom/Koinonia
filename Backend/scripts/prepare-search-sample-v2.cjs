// Solo copia autorizada y artefactos locales. Sin escrituras MongoDB.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const doc=require('../src/services/church-embedding-document.lab'),emb=require('../src/services/local-embeddings.lab');
const database='koinonia_synthetic_test_v2_local',out=path.resolve(__dirname,'../../outputs/search-sample-v2'),sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
async function read(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return fallback;throw e;}}
async function snapshot(limit){
 const env=require('dotenv').parse(await fs.readFile(path.resolve(__dirname,'../.env'),'utf8')),uri=env.MONGO_URI;
 if(!uri||decodeURIComponent(uri.slice(uri.indexOf('://')+3).split('/').slice(1).join('/').split('?')[0])!==database)throw Error('DATABASE_NOT_AUTHORIZED');
 const {MongoClient}=require('mongoose').mongo,client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,socketTimeoutMS:30000});
 try{await client.connect();const projection={_id:1,active:1,mergedInto:1,metadata:1,'importInfo.batchId':1,privateFields:1,identification:1,christianIdentity:1,doctrine:1,community:1,'location.commune':1,'location.city':1,'location.region':1,updatedAt:1};
 const rows=await client.db(database).collection('churches').find({},{projection}).sort({_id:1}).maxTimeMS(30000).toArray(),items=[],selection=[],exclusions=[];
 for(const c of rows){const id=String(c._id);let reason=c.mergedInto?'merged':c.active!==true?'inactive':!['published','verified'].includes(c.metadata?.dataStatus)?'not_published':!doc.eligible(c)?'showcase':null;
 if(reason){exclusions.push({id,reason});continue;}
 let docs=doc.prepareChurch(c);const rejected=docs.filter(d=>/https?:|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+\d[\d ()-]{6,}/i.test(d.text));docs=docs.filter(d=>!rejected.includes(d));
 for(const d of rejected)exclusions.push({id,field:d.source.field,part:d.source.part,reason:'contact_or_link_review'});
 for(const [field,hidden] of Object.entries(c.privateFields||{}))if(hidden===true)exclusions.push({id,field,reason:'hidden'});
 if(!docs.length){exclusions.push({id,reason:'no_public_text'});continue;}
 if(selection.length>=limit){exclusions.push({id,reason:'selection_limit'});continue;}
 selection.push({id,title:docs[0].title,updatedAt:c.updatedAt||null});items.push(...docs);
 }return {sourceChurches:rows.length,selection,exclusions,items};
 }finally{await client.close();}
}
async function versions(){const result={};for(const f of ['church-embedding-document.lab.js','church.service.js','local-embeddings.lab.js'])result[f]=sha(await fs.readFile(path.resolve(__dirname,'../src/services',f),'utf8'));result.pipeline=sha(await fs.readFile(__filename,'utf8'));return result;}
async function main(){
 const args=process.argv.slice(2);if(args.some(a=>!['--public-dns','--generate'].includes(a)&&!/^--limit=\d+$/.test(a)))throw Error('INVALID_ARGUMENT');if(args.includes('--public-dns'))require('node:dns').setServers(['1.1.1.1']);
 const generate=args.includes('--generate'),limit=Number(args.find(a=>a.startsWith('--limit='))?.split('=')[1]||100);if(limit<1||limit>1000)throw Error('INVALID_LIMIT');await fs.mkdir(out,{recursive:true});
 const current=await read(path.join(out,'active-vectors.json'),{items:[],model:null}),source=await snapshot(limit),code=await versions(),model={model:emb.MODEL,digest:'85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1',dimensions:emb.DIMENSIONS,formatVersion:emb.FORMAT_VERSION};
 const compatible=JSON.stringify(current.model)===JSON.stringify(model)&&JSON.stringify(current.versions)===JSON.stringify(code),old=new Map(current.items.map(d=>[d._id,d]));
 const items=source.items.map(d=>({...d,inputHash:sha(emb.inputText(d,'document'))})),wanted=new Set(items.map(d=>d._id));
 const reuse=d=>compatible&&old.get(d._id)?.inputHash===d.inputHash&&old.get(d._id)?.textHash===d.textHash;
 const changes={generate:items.filter(d=>!reuse(d)).map(d=>d._id),reuse:items.filter(reuse).map(d=>d._id),remove:current.items.filter(d=>!wanted.has(d._id)).map(d=>d._id)};
 const plan={schema:'local-sample-v2',database,limit,selectionPolicy:'eligible-id-ascending-v1',documentVersion:doc.VERSION,versions:code,model,source,items,changes,baseHash:sha(current),characters:items.reduce((n,d)=>n+d.text.length,0),embeddingRequests:Math.ceil(changes.generate.length/4)};const planHash=sha(plan);
 if(!generate){await fs.writeFile(path.join(out,'preview.json'),JSON.stringify({planHash,plan},null,2));const md=['# Vista previa de muestra ampliada','',`Copia: ${database}. Selección por ID ascendente: ${source.selection.length}/${source.sourceChurches} fichas; límite ${limit}. No es representativa.`,`${items.length} fragmentos; ${plan.characters} caracteres. Generar: ${changes.generate.length}; reutilizar: ${changes.reuse.length}; retirar del archivo activo: ${changes.remove.length}. Hasta ${plan.embeddingRequests} peticiones de cuatro textos. Tiempo no estimado sin medir el equipo; sin llamadas a Ollama en simulación.`,`Hash del plan: ${planHash}`,'','## Exclusiones',...Object.entries(source.exclusions.reduce((a,e)=>(a[e.reason]=(a[e.reason]||0)+1,a),{})).map(([k,n])=>`- ${k}: ${n}`),'','## Textos seleccionados',...items.map(d=>`### ${d.title} — ${d.source.field}\n\n${d.text}\n\nID: ${d._id} · hash: ${d.textHash} · dato de prueba: ${d.testData}`)];await fs.writeFile(path.join(out,'preview.md'),md.join('\n\n'));console.log(JSON.stringify({selected:source.selection.length,documents:items.length,characters:plan.characters,changes:{generate:changes.generate.length,reuse:changes.reuse.length,remove:changes.remove.length},preview:path.join(out,'preview.md')}));return;}
 const reviewed=await read(path.join(out,'preview.json'));if(reviewed.planHash!==sha(reviewed.plan)||reviewed.planHash!==planHash)throw Error('PREVIEW_CHANGED_RUN_SIMULATION_AGAIN');
 if(JSON.stringify(await emb.inventory('http://127.0.0.1:11435'))!==JSON.stringify(model))throw Error('MODEL_CHANGED_REVIEW_REQUIRED');
 const generated=[];for(let i=0;i<items.length;i+=4){const batch=items.slice(i,i+4),pending=batch.filter(d=>!reuse(d)),result=pending.length?await emb.embed(pending,'document'):null;for(const d of batch){const embedding=reuse(d)?old.get(d._id).embedding:result.vectors[pending.indexOf(d)];emb.vector(embedding);generated.push({...d,embedding});}}
 if(sha(await snapshot(limit))!==sha(source))throw Error('SOURCE_CHANGED_NOT_ACTIVATED');if(JSON.stringify(await emb.inventory('http://127.0.0.1:11435'))!==JSON.stringify(model))throw Error('MODEL_CHANGED_NOT_ACTIVATED');
 const next={schema:'local-sample-v2',database,createdAt:new Date().toISOString(),planHash,versions:code,model,retired:changes.remove,items:generated};const tmp=path.join(out,'active-vectors.tmp');await fs.writeFile(tmp,JSON.stringify(next));await fs.rename(tmp,path.join(out,'active-vectors.json'));console.log(JSON.stringify({activated:generated.length,retired:changes.remove.length}));
}
main().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'LOCAL_SAMPLE_FAILED');process.exitCode=1;});
