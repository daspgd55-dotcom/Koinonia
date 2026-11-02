const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'../..');
const m=require(root+'/Backend/node_modules/mongoose');require(root+'/Backend/node_modules/dotenv').config({path:root+'/Backend/.env',quiet:true});require('node:dns').setServers(['1.1.1.1']);
const {readDataset,importRecords}=require(root+'/Backend/src/services/import.service'),{matchRecord}=require(root+'/Backend/src/services/import-merge.service');
const Church=require(root+'/Backend/src/models/church.model');
const write=(n,v)=>fs.writeFileSync(path.join(__dirname,n),JSON.stringify(v,null,2));
async function main(){const file=path.join(__dirname,'churches.import.ndjson'),records=await readDataset(file);if(records.length!==409)throw Error('unexpected_batch_size');
await m.connect(process.env.MONGO_URI,{dbName:'Koinonia_pilot',autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:15000});
const db=m.connection.db,originals=await db.collection('churches').find().toArray(),admins=await db.collection('users').find({role:'admin',active:true},{projection:{_id:1,email:1}}).toArray();
if(admins.length!==1)throw Error('requires_unique_active_admin');
const actions=records.map(r=>{const match=matchRecord(r.church,originals);return {key:r.externalKey,name:r.church.identification.name,action:match.review?'review':match.target?'existing':'insert',reason:match.reason};});
const report={database:db.databaseName,batchSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before:originals.length,adminId:String(admins[0]._id),counts:actions.reduce((a,r)=>(a[r.action]=(a[r.action]||0)+1,a),{}),actions};write('preimport-plan.json',report);
if(actions.some(a=>a.action==='review'))throw Error('identity_review_required');
if(!process.argv.includes('--apply')){console.log(JSON.stringify({...report,actions:undefined}));return;}
const backup=path.join(root,'Backend/.cache/import-backups',Date.now()+'-pilot-before-v3.ejson');fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,m.mongo.BSON.EJSON.stringify(originals,{relaxed:false}));
const indexes=await db.collection('churches').indexes();if(!indexes.some(i=>i.unique&&i.key['externalProfile.provider']===1&&i.key['externalProfile.placeId']===1))await db.collection('churches').createIndex({'externalProfile.provider':1,'externalProfile.placeId':1},{unique:true,partialFilterExpression:{'externalProfile.provider':{$type:'string'},'externalProfile.placeId':{$type:'string'}}});
const result=await importRecords(records,{email:admins[0].email,demoPublish:false});write('import-result.json',{...result,backup,completedAt:new Date().toISOString()});
const after=await db.collection('churches').find().toArray(),byId=new Map(after.map(d=>[String(d._id),d]));
const unchanged=originals.every(d=>m.mongo.BSON.EJSON.stringify(d)===m.mongo.BSON.EJSON.stringify(byId.get(String(d._id))));
const imported=records.map(r=>after.filter(d=>d.externalProfile?.provider==='google_maps'&&d.externalProfile?.placeId===r.church.externalProfile.placeId));
const verification={after:after.length,originalsUnchanged:unchanged,allIdentitiesPresentExactlyOnce:imported.every(a=>a.length===1),drafts:imported.filter(a=>a[0]?.metadata?.dataStatus==='draft').length,unauthorized:imported.filter(a=>a[0]?.verification?.authorized===false).length,issuesPreserved:records.every((r,i)=>JSON.stringify(r.provenance.issues)===JSON.stringify(imported[i][0]?.importInfo?.issues))};write('verification.json',verification);console.log(JSON.stringify({result,verification}));
if(!unchanged||!verification.allIdentitiesPresentExactlyOnce||!verification.issuesPreserved)throw Error('verification_failed');}
main().catch(e=>{console.error(JSON.stringify({error:e.name,code:e.code,reason:/^[a-z_]+$/.test(e.message)?e.message:undefined,progress:e.importProgress}));process.exitCode=1;}).finally(()=>m.disconnect());
