const fs=require('node:fs/promises'),path=require('node:path'),{parseArgs}=require('node:util');
const {connectDB,disconnectDB}=require('../src/config/db'),{loadConfig}=require('../src/config/env');
const Church=require('../src/models/church.model'),User=require('../src/models/user.model'),Interaction=require('../src/models/interaction.model'),Source=require('../src/models/source.model');
const {planReview}=require('../src/services/review-consolidation.service');
const BATCH='review-2026-09-30',DIR=path.resolve('data',BATCH);
async function main(){
 const {values:v}=parseArgs({options:{apply:{type:'boolean',default:false},admin:{type:'string'},directory:{type:'string'}}});
 const directory=v.directory?path.resolve(v.directory):DIR;
 await connectDB(loadConfig().mongoUri);if(!Church.db.name.endsWith('_demo')||process.env.NODE_ENV==='production')throw Error('Solo base _demo fuera de producción');
 const actor=await User.findOne({email:v.admin,role:'admin',active:true});if(!actor)throw Error('Administrador activo requerido');
 const inventory=(await fs.readFile(path.join(directory,'consolidated.ndjson'),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
 const original=await Church.find().lean(),existing=JSON.parse(JSON.stringify(original));
 const already=new Set(existing.flatMap(c=>c.reviewImport?.externalKeys||[]));
 const pending=inventory.filter(i=>!already.has(i.externalKey));
 const excluded=new Map(inventory.filter(i=>i.decision==='excluded').map(i=>[i.externalKey,i]));
 const unwanted=existing.filter(c=>excluded.has('google_maps:'+c.externalProfile?.placeId));
 const plans=planReview(pending,existing.filter(c=>!unwanted.includes(c)));
 for(const c of unwanted.filter(c=>c.active&&c.metadata.testData&&!c.verification?.authorized))plans.push({action:'deactivate',anchorId:c._id,name:c.identification.name,reason:excluded.get('google_maps:'+c.externalProfile.placeId).reason,externalKeys:['google_maps:'+c.externalProfile.placeId]});
 const summary={mode:v.apply?'apply':'plan',database:Church.db.name,before:existing.length,alreadyProcessed:already.size,counts:plans.reduce((r,p)=>(r[p.action]=(r[p.action]||0)+1,r),{}),consolidatedExisting:plans.reduce((n,p)=>n+(p.loserIds?.length||0),0),actions:plans};
 const output=path.join(directory,v.apply?'applied.json':'plan.json');
 await fs.writeFile(output,JSON.stringify(summary,null,2));
 if(!v.apply){console.log(JSON.stringify({...summary,actions:undefined},null,2));return;}
 const backup=path.resolve('.cache/import-backups',Date.now()+'-review.json');await fs.mkdir(path.dirname(backup),{recursive:true});
 const sources=await Source.find().lean(),interactions=await Interaction.find().lean();
 await fs.writeFile(backup,JSON.stringify({churches:original,sources,interactions},null,2));summary.backup=backup;summary.applied={insert:0,merge:0,retired:0,deactivate:0,movedSources:0,movedInteractions:0};
 try{
  // Prevalidar todos los documentos finales antes de escribir.
  for(const p of plans.filter(p=>['merge','insert'].includes(p.action))){
   const old=existing.find(c=>c._id===p.anchorId);
   const raw={...(old||{}),...p.content,reviewImport:{batchId:BATCH,activityStatus:'unverified',decision:'included_for_testing',externalKeys:[...new Set([...(old?.reviewImport?.externalKeys||[]),...p.externalKeys])]},updatedBy:actor._id};
   if(old)raw.representatives=[...new Set(existing.filter(c=>p.existingIds.includes(c._id)).flatMap(c=>c.representatives||[]))];
   if(!old)Object.assign(raw,{createdBy:actor._id,representatives:[],active:true,verification:{authorized:false,source:'google_maps'},metadata:{dataStatus:'published',testData:true,version:1},importInfo:{...p.provenance.provenance,schemaVersion:p.provenance.schemaVersion,importedAt:new Date()}});
   else raw.metadata={...old.metadata,version:old.metadata.version+1};
   const doc=new Church(raw);await doc.validate();p.prepared=doc.toObject();
  }
  for(const p of plans.filter(p=>p.action!=='review')){
   if(p.action==='deactivate'){
    const doc=await Church.findById(p.anchorId),before=existing.find(c=>c._id===p.anchorId);if(doc.metadata.version!==before.metadata.version)throw Error('Conflicto al desactivar');
    doc.active=false;doc.metadata.version++;doc.updatedBy=actor._id;doc.reviewImport={batchId:BATCH,decision:'excluded',reason:p.reason,externalKeys:p.externalKeys};await doc.save();summary.applied.deactivate++;continue;
   }
   let anchor;
   if(p.action==='insert'){anchor=new Church(p.prepared);await anchor.save();p.anchorId=String(anchor._id);summary.applied.insert++;}
   else{
    anchor=await Church.findById(p.anchorId);const before=existing.find(c=>c._id===p.anchorId);
    if(!anchor||anchor.metadata.version!==before.metadata.version)throw Error('Conflicto de versión; detener y revisar respaldo');
    for(const key of Object.keys(p.content))anchor.set(key,p.content[key]);anchor.representatives=p.prepared.representatives;anchor.reviewImport=p.prepared.reviewImport;anchor.metadata.version++;anchor.updatedBy=actor._id;await anchor.save();summary.applied.merge++;
   }
   for(const id of p.loserIds||[]){
    const loser=await Church.findById(id);const before=existing.find(c=>c._id===id);if(loser.metadata.version!==before.metadata.version)throw Error('Duplicado cambió durante merge');
    // Para dos selecciones del mismo usuario, conservar la última y respaldar ambas.
    for(const entry of await Interaction.find({church:id})){
     const current=await Interaction.findOne({user:entry.user,church:anchor._id});
     if(current){if(entry.updatedAt>current.updatedAt){current.type=entry.type;current.reason=entry.reason;await current.save();}await entry.deleteOne();}
     else {entry.church=anchor._id;await entry.save();}summary.applied.movedInteractions++;
    }
    const moved=await Source.updateMany({church:id},{$set:{church:anchor._id}});summary.applied.movedSources+=moved.modifiedCount;
    loser.active=false;loser.mergedInto=anchor._id;loser.metadata.version++;loser.updatedBy=actor._id;await loser.save();summary.applied.retired++;
   }
   delete p.prepared;
  }
  summary.after=await Church.countDocuments();summary.activeAfter=await Church.countDocuments({active:true});
 }catch(e){summary.error=e.message;throw e;}finally{for(const p of plans)delete p.prepared;await fs.writeFile(output,JSON.stringify(summary,null,2));}
 console.log(JSON.stringify({...summary,actions:undefined},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(disconnectDB);
