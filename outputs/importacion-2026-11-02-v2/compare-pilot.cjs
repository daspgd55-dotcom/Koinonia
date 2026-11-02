const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),mongoose=require(root+'/Backend/node_modules/mongoose');
require(root+'/Backend/node_modules/dotenv').config({path:root+'/Backend/.env',quiet:true});require('node:dns').setServers(['1.1.1.1']);
const {matchRecord,mergeRecord}=require(root+'/Backend/src/services/import-merge.service');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8').trim().split(/\r?\n/).map(JSON.parse);
const brief=d=>({id:String(d._id),name:d.identification?.name,address:d.location?.address,active:d.active,status:d.metadata?.dataStatus});
async function main(){const client=new mongoose.mongo.MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:15000});
try{await client.connect();const names=(await client.db('admin').admin().listDatabases({nameOnly:true,authorizedDatabases:true})).databases.map(d=>d.name);const dbname=names.includes('Koinonia_pilot')?'Koinonia_pilot':names.find(n=>n.toLowerCase()==='koinonia_pilot');if(!dbname)throw Error('pilot_database_not_found');
const db=client.db(dbname),existing=await db.collection('churches').find({},{projection:{identification:1,location:1,contact:1,externalProfile:1,media:1,metadata:1,active:1,mergedInto:1}}).toArray();
const compare=(r,scope)=>{const incoming=r.church,m=matchRecord(incoming,existing);let merge=m.target?mergeRecord(m.target,incoming):null;return {scope,key:r.externalKey,name:incoming.identification?.name,address:incoming.location?.address,action:m.review?'review':m.target?(merge.review?'review':merge.changed?'enrich_existing':'unchanged'):'potential_new',reason:merge?.review?merge.reason:m.reason,target:m.target?brief(m.target):undefined,candidates:m.candidates?.map(brief),conflicts:merge?.conflicts,postalCandidates:m.postalCandidates};};
const actions=read('churches.import.ndjson').map(r=>compare(r,'validated_batch'));
const pending=read('revision.ndjson').map(e=>({...compare(e.preparedRecord,'pending_input'),stagingId:e.stagingId,inputReason:e.classification.reason}));
const counts=rows=>rows.reduce((a,r)=>(a[r.action]=(a[r.action]||0)+1,a),{});
const report={database:dbname,checkedAt:new Date().toISOString(),writes:0,existing:existing.length,existingChurches:existing.map(brief),active:existing.filter(c=>c.active).length,validatedBatch:counts(actions),pendingInput:counts(pending),actions,pending};
fs.writeFileSync(path.join(__dirname,'comparacion-pilot.json'),JSON.stringify(report,null,2));
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';fs.writeFileSync(path.join(__dirname,'comparacion-pilot.csv'),'\ufeff'+[['Grupo','Nombre','Direccion','Resultado','Motivo','ID existente','Nombre existente','Conflictos'],...[...actions,...pending].map(a=>[a.scope,a.name,a.address,a.action,a.reason,a.target?.id,a.target?.name,a.conflicts?.join('; ')])].map(r=>r.map(csv).join(',')).join('\n'));
console.log(JSON.stringify({...report,actions:undefined,pending:undefined}));
}finally{await client.close();}}
main().catch(e=>{console.error(JSON.stringify({error:e.name,code:e.code,reason:['pilot_database_not_found'].includes(e.message)?e.message:undefined}));process.exitCode=1;});
