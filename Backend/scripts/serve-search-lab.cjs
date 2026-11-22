// Servidor independiente, solo loopback. Nunca montar en app.js ni publicar estos recursos.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto'),express=require('express');
const {inventory,embed,cosine,vector,inputText}=require('../src/services/local-embeddings.lab');
const {prepareChurch}=require('../src/services/church-embedding-document.lab');
const {interpretFreeText}=require('../src/services/free-search-intent.lab');
const {assessFreeTextCandidates,assessCandidates,buildIntent}=require('../src/services/search-intent.lab');
const {assessTopics}=require('../src/services/search-topic-evidence.lab');
const port=4600,origin='http://127.0.0.1:'+port,database='koinonia_synthetic_test_v2_local',sha=s=>createHash('sha256').update(s).digest('hex');
async function main(){
 if(process.env.NODE_ENV==='production')throw Error('LOCAL_ONLY');
 if(process.argv.slice(2).some(a=>!['--public-dns','--expanded'].includes(a)))throw Error('INVALID_ARGUMENT');if(process.argv.includes('--public-dns'))require('node:dns').setServers(['1.1.1.1']);
 const expanded=process.argv.includes('--expanded'),root=path.resolve(__dirname,'../..'),file=expanded?'expanded-vectors-v1.json':'sample-vectors-2026-11-18T05-21-16-806Z.json',sample=JSON.parse(await fs.readFile(path.join(root,'outputs/church-embeddings-local',file),'utf8'));
 if(sample.items.length!==(expanded?45:15)||new Set(sample.items.map(d=>d._id)).size!==sample.items.length)throw Error('INVALID_SAMPLE');for(const d of sample.items){vector(d.embedding);if(sha(d.text)!==d.textHash||sha(inputText(d,'document'))!==d.inputHash)throw Error('INVALID_SAMPLE');}
 const ids=[...new Set(sample.items.map(d=>d.churchId))];if(ids.length!==(expanded?20:5)||ids.some(id=>! /^[a-f0-9]{24}$/.test(id)))throw Error('INVALID_SAMPLE');
 const provenance={sampleFile:file,sampleHash:sha(JSON.stringify(sample)),model:sample.model,code:await require('./search-diagnostics.cjs').versions(),serverHash:sha(await fs.readFile(__filename,'utf8'))};
 const env=require('dotenv').parse(await fs.readFile(path.join(root,'Backend/.env'),'utf8')),uri=env.MONGO_URI;
 if(!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri)||decodeURIComponent(uri.slice(uri.indexOf('://')+3).split('/').slice(1).join('/').split('?')[0])!==database)throw Error('DATABASE_NOT_AUTHORIZED');
 const {MongoClient,ObjectId}=require('mongoose').mongo;
 const app=express();app.disable('x-powered-by');let busy=false,nextQueryAt=0;
 app.use(require('helmet')({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],connectSrc:["'self'"],upgradeInsecureRequests:null}}}));
 app.use((req,res,next)=>{res.set('Cache-Control','no-store');if(req.headers.host!=='127.0.0.1:'+port||req.headers.origin&&req.headers.origin!==origin)return res.status(403).json({error:'Acceso exclusivo del laboratorio local.'});next();});
 app.use(express.json({limit:'16kb'}));
 for(const [route,file] of [['/','index.html'],['/lab.css','lab.css'],['/lab.js','lab.js']])app.get(route,(req,res)=>res.sendFile(path.join(__dirname,'search-lab-ui',file)));
 app.get('/status',(req,res)=>res.json({sampleChurches:ids.length,sampleFragments:sample.items.length,model:sample.model.model,database,expanded}));
 app.post('/interpret',(req,res)=>{
  if(req.headers.origin!==origin||!req.is('application/json'))return res.status(403).json({error:'Usa la pantalla local.'});
  try{const body=req.body;if(!body||Object.keys(body).some(k=>!['query','review'].includes(k))||typeof body.query!=='string'||!body.query.trim()||body.query.length>1000)throw Error();
   const intent=body.review?{...buildIntent(body.review),query:body.query}:interpretFreeText(body.query);
   const review=body.review||{requirementsText:[...intent.evidence.filter(e=>e.kind==='requirement').map(e=>e.text),...intent.requirements.unresolved].join('; '),interestText:intent.interests.map(i=>i.text).join('\n')};
   res.json({intent,review});
  }catch{res.status(400).json({error:'Revisa los campos: máximo 1000 caracteres por campo y al menos una condición o interés.'});}
 });
 app.post('/query',async(req,res)=>{
  if(req.headers.origin!==origin||!req.is('application/json'))return res.status(403).json({error:'Usa la pantalla local para consultar.'});
  const query=req.body?.query;if(Object.keys(req.body||{}).some(k=>!['query','review'].includes(k))||typeof query!=='string'||!query.trim()||query.length>1000)return res.status(400).json({error:'Escribe una consulta de hasta 1000 caracteres.'});
  if(busy||Date.now()<nextQueryAt)return res.status(429).json({error:'Espera a que termine la consulta anterior y vuelve a intentar.'});
  busy=true;nextQueryAt=Date.now()+2000;const started=Date.now();let phase='interpretation';
  try{
   let intent;try{intent=req.body.review?{...buildIntent(req.body.review),query,review:req.body.review}:interpretFreeText(query);}catch{return res.status(400).json({error:'Revisa las condiciones e intereses antes de consultar.'});}
   if(intent.needsClarification)return res.json({intent,provenance,accepted:[],held:[],needsClarification:true,elapsedMs:Date.now()-started,notice:'Aclara los fragmentos pendientes. No se consultaron Ollama ni MongoDB.'});
   phase='ollama';const baseUrl='http://127.0.0.1:11435',model=await inventory(baseUrl);if(JSON.stringify(model)!==JSON.stringify(sample.model))throw Error('MODEL_MISMATCH');
   const interestText=intent.interests.map(i=>i.text).join('\n'),inputs=[{text:req.body.review?intent.retrievalText:query}];if(interestText&&interestText!==inputs[0].text)inputs.push({text:interestText});
   const result=await embed(inputs,'query',{baseUrl});if((await inventory(baseUrl)).digest!==model.digest)throw Error('MODEL_MISMATCH');
   phase='database';const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,connectTimeoutMS:15000,socketTimeoutMS:30000});let churches;
   try{await client.connect();churches=await client.db(database).collection('churches').find({_id:{$in:ids.map(id=>new ObjectId(id))}},{projection:{_id:1,active:1,mergedInto:1,metadata:1,'importInfo.batchId':1,privateFields:1,identification:1,christianIdentity:1,doctrine:1,community:1,'location.commune':1,'location.city':1,'location.region':1,'location.accessibilityDetails':1,updatedAt:1}}).toArray();}finally{await client.close();}
   phase='ranking';const current=new Map(churches.flatMap(prepareChurch).map(d=>[d._id,d]));
   const valid=sample.items.filter(d=>current.get(d._id)?.textHash===d.textHash);
   const variants=inputs.map((input,i)=>{const ranked=valid.map(d=>({churchId:d.churchId,title:d.title,fragment:d.text,field:d.source.field,score:cosine(result.vectors[i],d.embedding),testData:churches.find(c=>String(c._id)===d.churchId)?.metadata?.testData===true})).sort((a,b)=>b.score-a.score||a.churchId.localeCompare(b.churchId)||a.field.localeCompare(b.field));
    return assessTopics({mode:i?'interest':'full',text:input.text,...(req.body.review?assessCandidates(ranked,churches,req.body.review):assessFreeTextCandidates(ranked,churches,query)),intent},valid);});
   const selected=variants.find(v=>v.mode==='interest')||variants[0];
   res.json({...selected,variants,provenance,elapsedMs:Date.now()-started,excludedFragments:sample.items.length-valid.length,checkedAt:new Date().toISOString(),notice:'No hay coincidencia temática confirmada automáticamente. Estos son candidatos para revisar, aunque cumplan los requisitos estructurados. La cercanía textual no prueba actividades concretas. No hay umbral calibrado; los datos pueden ser de prueba.'});
  }catch(e){res.status(503).json({error:phase==='ollama'?'No se pudo usar embeddinggemma local. Comprueba Ollama en el puerto 11435 y que conserve el modelo usado por la muestra.':phase==='database'?'No se pudo leer la copia autorizada. No se muestran resultados sin comprobar las fichas.':'No se pudo completar la consulta del laboratorio.'});}
  finally{busy=false;}
 });
 app.use((req,res)=>res.status(404).json({error:'Ruta no encontrada.'}));
 app.use((err,req,res,next)=>res.status(400).json({error:'Solicitud inválida o demasiado grande.'}));
 const server=app.listen(port,'127.0.0.1',()=>console.log('Laboratorio local: '+origin));server.on('error',()=>{console.error('No se pudo abrir el puerto local 4600.');process.exitCode=1;});
}
main().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'LOCAL_LAB_START_FAILED');process.exitCode=1;});
