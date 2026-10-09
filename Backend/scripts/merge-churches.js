const fs=require('node:fs/promises'),path=require('node:path');
const {parseArgs}=require('node:util');
const {readDataset,documentFor}=require('../src/services/import.service');
const {matchRecord,mergeRecord}=require('../src/services/import-merge.service');
const {connectDB,disconnectDB}=require('../src/config/db');
const {loadConfig}=require('../src/config/env');
const Church=require('../src/models/church.model'),User=require('../src/models/user.model');
async function main(){
 const {values:v}=parseArgs({options:{file:{type:'string'},admin:{type:'string'},apply:{type:'boolean',default:false},'demo-publish':{type:'boolean',default:false},report:{type:'string'}},strict:true});
 if(!v.file||!v.admin||!v.report) throw Error('Requiere --file, --admin y --report; --apply aplica la conciliación');
 const records=await readDataset(v.file);await connectDB(loadConfig().mongoUri);
 const admin=await User.findOne({email:v.admin.trim().toLowerCase(),role:'admin',active:true}); if(!admin) throw Error('Administrador activo requerido');
 if(v['demo-publish']&&(!Church.db.name.endsWith('_demo')||process.env.NODE_ENV==='production')) throw Error('Publicación de prueba solo en _demo fuera de producción');
 const originals=await Church.find().lean();const working=JSON.parse(JSON.stringify(originals));const actions=[];
 for(const record of records){
  const incoming=record.church,match=matchRecord(incoming,working), base={row:record.provenance.sourceRow,externalKey:record.externalKey,name:incoming.identification.name,reason:match.reason};
  if(match.review){actions.push({...base,action:'review',candidates:match.candidates.map(d=>({id:String(d._id),name:d.identification.name,address:d.location.address}))});continue;}
  if(match.target){
   const merged=mergeRecord(match.target,incoming);
   if(merged.review){actions.push({...base,action:'review',reason:merged.reason});continue;}
   actions.push({...base,action:merged.changed?'update':'unchanged',id:String(match.target._id),conflicts:merged.conflicts,record,result:merged.result});
   Object.assign(match.target,merged.result);
  }else{
   const doc=documentFor(record,admin._id,{demoPublish:v['demo-publish']});await doc.validate();const result=JSON.parse(JSON.stringify(doc));
   working.push(result);actions.push({...base,action:'insert',id:String(doc._id),postalCandidates:match.postalCandidates,record,result});
  }
 }
 await fs.mkdir(path.dirname(path.resolve(v.report)),{recursive:true});
 const summary={mode:v.apply?'apply':'plan',database:Church.db.name,before:originals.length,input:records.length,counts:actions.reduce((r,a)=>(r[a.action]=(r[a.action]||0)+1,r),{}),actions:actions.map(({record,result,...a})=>a)};
 await fs.writeFile(v.report,JSON.stringify(summary,null,2));
 if(v.apply){
  const backup=path.resolve('.cache/import-backups',Date.now()+'-churches.json');await fs.mkdir(path.dirname(backup),{recursive:true});await fs.writeFile(backup,JSON.stringify(originals,null,2));summary.backup=backup;summary.applied={insert:0,update:0};
  try{
   for(const a of actions){
    if(a.action==='insert'){const doc=new Church(a.result);await doc.save();summary.applied.insert++;}
    if(a.action==='update'){
     const doc=await Church.findById(a.id);if(!doc)throw Error('Ficha eliminada durante la conciliación');
     const original=originals.find(d=>String(d._id)===a.id);
     const priorUpdates=actions.slice(0,actions.indexOf(a)).filter(x=>x.action==='update'&&x.id===a.id).length;
     if(original&&doc.metadata.version!==original.metadata.version+priorUpdates)throw Error('La ficha cambió durante la conciliación; volver a generar plan');
     for(const key of ['identification','location','contact','externalProfile','media'])doc.set(key,a.result[key]);
     doc.metadata.version++;doc.updatedBy=admin._id;
     // Mantener estado, autorización, representantes e identidad; enriquecimiento externo, no publicación institucional.
     await doc.save();summary.applied.update++;
    }
   }
   summary.after=await Church.countDocuments();
  }catch(error){summary.error=error.message;throw error;}
  finally{await fs.writeFile(v.report,JSON.stringify(summary,null,2));}
 }
 console.log(JSON.stringify({...summary,actions:undefined},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(disconnectDB);
