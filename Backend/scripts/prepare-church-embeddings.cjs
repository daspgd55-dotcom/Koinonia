// Lectura de la copia autorizada. Nunca crea colecciones, índices ni vectores remotos.
const fs=require('node:fs/promises'),path=require('node:path');
const {prepareChurch,VERSION}=require('../src/services/church-embedding-document.lab');
async function main(){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--public-dns'))throw Error('INVALID_ARGUMENT');if(args.includes('--public-dns'))require('node:dns').setServers(['1.1.1.1']);
 const database='koinonia_synthetic_test_v2_local',env=require('dotenv').parse(await fs.readFile(path.resolve(__dirname,'../.env'),'utf8')),uri=env.MONGO_URI;
 if(!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri)||decodeURIComponent(uri.slice(uri.indexOf('://')+3).split('/').slice(1).join('/').split('?')[0])!==database)throw Error('DATABASE_NOT_AUTHORIZED');
 const {MongoClient}=require('mongoose').mongo,client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,socketTimeoutMS:30000});
 try{
  await client.connect();const projection={_id:1,active:1,mergedInto:1,metadata:1,'importInfo.batchId':1,privateFields:1,identification:1,christianIdentity:1,doctrine:1,community:1,'location.commune':1,'location.city':1,'location.region':1,updatedAt:1};
  const rows=await client.db(database).collection('churches').find({},{projection}).toArray(),documents=rows.flatMap(prepareChurch),churches=new Set(documents.map(d=>d.churchId)).size;
  const directory=path.resolve(__dirname,'../../outputs/church-embeddings-local');await fs.mkdir(directory,{recursive:true});
  const file=path.join(directory,'plan-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
  const report={createdAt:new Date().toISOString(),database,documentVersion:VERSION,mode:'read-only-preview',sourceChurches:rows.length,indexableChurches:churches,documents:documents.length,items:documents};
  await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sourceChurches:rows.length,indexableChurches:churches,documents:documents.length,file}));
 }finally{await client.close();}
}
main().catch(e=>{console.error(JSON.stringify({name:e.name,code:e.code||null,reason:/^[A-Z_]+$/.test(e.message)?e.message:'PREVIEW_FAILED'}));process.exitCode=1;});
