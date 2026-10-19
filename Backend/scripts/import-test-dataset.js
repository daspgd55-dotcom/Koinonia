// Plan local por defecto. --apply carga una base exclusiva de pruebas del clúster configurado.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseArgs}=require('node:util');
const mongoose=require('mongoose'),Church=require('../src/models/church.model'),User=require('../src/models/user.model');
const {church:churchSchema}=require('../src/validation/schemas'),{BATCH}=require('./build-test-dataset');
const DATABASE='koinonia_synthetic_test_v2',ROOT=path.resolve(__dirname,'../..');
require('dotenv').config({path:path.join(ROOT,'Backend/.env'),quiet:true});
function configureDns(server){
 if(!server)return;
 if(!require('node:net').isIP(server))throw Error('--dns-server requiere una dirección IP válida');
 require('node:dns').setServers([server]);
}
function failureDetails(e){
 const dnsFailure=['querySrv','queryTxt'].includes(e.syscall);
 return {status:'failed',errorType:e.name,code:e.code||null,...(dnsFailure?{step:'dns',syscall:e.syscall,reason:'Falló la resolución DNS de Atlas antes de autenticar.',hint:'Reintenta con --dns-server 1.1.1.1 si tu red permite ese servidor; solo afecta este proceso.'}:e.name==='Error'&&!e.code?{reason:e.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g,'[URI OCULTA]')}: {})};
}
function read(name){return fs.readFileSync(path.join(ROOT,'outputs',BATCH,name),'utf8').trim().split(/\r?\n/).map(JSON.parse);}
async function prepare(){
 const fixtures=read('churches.test.ndjson'),corpus=read('rag.test.ndjson'),actor=new mongoose.Types.ObjectId('000000000000000000000201');
 if(fixtures.length!==336||new Set(fixtures.map(f=>f.id)).size!==fixtures.length)throw Error('Cantidad o identidades inesperadas');
 const documents=[];
 for(const f of fixtures){
  if(f.batchId!==BATCH||f.testOnly!==true||f.church.verification.source!=='synthetic_test_unverified'||f.church.verification.authorized!==false)throw Error('Ficha sin marcas de prueba');
  churchSchema.parse(f.church);
  const doc=new Church({...f.church,_id:f.id,createdBy:actor,updatedBy:actor,representatives:[],active:true,metadata:{dataStatus:'published',testData:true,version:1},importInfo:{batchId:BATCH,schemaVersion:f.schemaVersion,sourceFile:'churches.test.ndjson',importedAt:new Date(),issues:['synthetic_or_inferred_unverified','test_only']}});
  await doc.validate();documents.push(doc.toObject());
 }
 if(corpus.length!==fixtures.length||new Set(corpus.map(d=>d.churchId)).size!==fixtures.length||corpus.some(d=>d.batchId!==BATCH||!d.testOnly||d.verified!==false||!fixtures.some(f=>f.id===d.churchId)))throw Error('Corpus incompatible');
 return {fixtures,corpus,documents,actor};
}
async function main(){
 const {values}=parseArgs({options:{apply:{type:'boolean',default:false},'dns-server':{type:'string'}}});configureDns(values['dns-server']);
 const data=await prepare();
 console.log(JSON.stringify({mode:values.apply?'apply':'local_plan',database:DATABASE,batchId:BATCH,churches:data.documents.length,ragDocuments:data.corpus.length,originalsModified:false}));
 if(!values.apply)return;
 if(!process.env.MONGO_URI)throw Error('Falta MONGO_URI en Backend/.env');
 // Se fuerza dbName: nunca se escribe sobre la base de la URI original.
 await mongoose.connect(process.env.MONGO_URI,{dbName:DATABASE,serverSelectionTimeoutMS:10000,autoIndex:false});
 const db=mongoose.connection.db;
 if(db.databaseName!==DATABASE)throw Error('Destino de pruebas incorrecto');
 const ownership=await db.collection('churches').countDocuments({$or:[{'importInfo.batchId':{$ne:BATCH}},{'metadata.testData':{$ne:true}}]});
 const otherFixtures=await db.collection('test_fixture_provenance').countDocuments({batchId:{$ne:BATCH}});
 const otherCorpus=await db.collection('rag_test_documents').countDocuments({batchId:{$ne:BATCH}});
 const otherUsers=await db.collection('users').countDocuments({_id:{$ne:data.actor}});
 const oldActor=await db.collection('users').findOne({_id:data.actor});
 if(ownership||otherFixtures||otherCorpus||otherUsers||(oldActor&&(oldActor.email!=='fixture-owner@example.invalid'||oldActor.active!==false)))throw Error('La base contiene registros ajenos al lote; importación detenida');
 const prior=await db.collection('test_batches').findOne({_id:BATCH});
 if(prior?.status==='complete'){
  const counts=await Promise.all(['churches','test_fixture_provenance','rag_test_documents'].map(n=>db.collection(n).countDocuments()));
  if(counts.some(n=>n!==336))throw Error('Lote previo incompleto o modificado; revisar antes de reimportar');
  console.log(JSON.stringify({status:'already_imported',counts}));return;
 }
 // Atlas admite transacciones; se crean colecciones e índices antes de abrirla.
 for(const name of ['churches','users','test_fixture_provenance','rag_test_documents','test_batches']){
  if(!(await db.listCollections({name}).toArray()).length)await db.createCollection(name);
 }
 await db.collection('churches').createIndex({'location.coordinates':'2dsphere'});
 await db.collection('churches').createIndex({'importInfo.batchId':1,'metadata.testData':1});
 const password=await require('bcryptjs').hash(crypto.randomBytes(48).toString('hex'),10);
 const user=new User({_id:data.actor,name:'Autor técnico de fichas de prueba',email:'fixture-owner@example.invalid',password,role:'admin',active:false});await user.validate();
 const session=await mongoose.startSession();
 try{
  await session.withTransaction(async()=>{
   await db.collection('users').updateOne({_id:data.actor},{$setOnInsert:user.toObject()},{upsert:true,session});
   await db.collection('churches').bulkWrite(data.documents.map(d=>({replaceOne:{filter:{_id:d._id},replacement:d,upsert:true}})),{session});
   await db.collection('test_fixture_provenance').bulkWrite(data.fixtures.map(f=>({replaceOne:{filter:{_id:f.id},replacement:{_id:f.id,...f},upsert:true}})),{session});
   await db.collection('rag_test_documents').bulkWrite(data.corpus.map(d=>({replaceOne:{filter:{_id:d.id},replacement:{_id:d.id,...d},upsert:true}})),{session});
   await db.collection('test_batches').replaceOne({_id:BATCH},{_id:BATCH,testOnly:true,status:'complete',churches:336,ragDocuments:336,importedAt:new Date()},{upsert:true,session});
  });
 }finally{await session.endSession();}
 const counts=await Promise.all(['churches','test_fixture_provenance','rag_test_documents'].map(n=>db.collection(n).countDocuments()));
 if(counts.some(n=>n!==336))throw Error('La comprobación final de cantidades falló');
 console.log(JSON.stringify({status:'imported',database:DATABASE,churches:counts[0],provenance:counts[1],ragDocuments:counts[2]}));
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify(failureDetails(e)));process.exitCode=1;}).finally(()=>mongoose.disconnect());
module.exports={prepare,DATABASE,configureDns,failureDetails};
