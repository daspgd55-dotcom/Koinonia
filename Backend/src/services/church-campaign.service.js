const {createHash,randomUUID}=require('node:crypto'),Import=require('../models/church-contact-import.model'),Church=require('../models/church.model'),Invitation=require('../models/church-outreach-invitation.model'),base=require('./church-outreach.service'),mail=require('./church-outreach-mail.service'),{HttpError}=require('../utils/errors'),{z}=require('../validation/schemas');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function preview(ids,session=null){
 const batches=await Import.find({_id:{$in:ids}}).sort({_id:1}).session(session).lean(),map=new Map();
 for(const b of batches)for(const a of b.associations)for(const raw of a.recipients){const email=raw.trim().toLowerCase(),key=String(a.church)+'|'+email;if(!map.has(key))map.set(key,{key,churchId:String(a.church),email,sources:[]});map.get(key).sources.push({batch:String(b._id),source:b.source,row:a.sourceRow});}
 const rows=[];for(const r of map.values()){
  const c=await Church.findById(r.churchId).session(session).lean(),prior=await Invitation.findOne({church:r.churchId,'recipient.email':r.email,active:true,lifecycle:{$in:['draft','ready']}}).sort({createdAt:-1}).session(session).lean(),reasons=[];
  if(!z.string().email().safeParse(r.email).success)reasons.push('Correo inválido');
  if(!c||c.mergedInto)reasons.push('Ficha ausente o fusionada');
  const testData=!!(c?.metadata?.testData||c?.testOnly||c?.importInfo?.batchId?.includes('synthetic'));
  if(await mail.suppressed(r.churchId,r.email,session))reasons.push('Contacto detenido');
  if(prior)reasons.push(prior.expiresAt<=new Date()?'El ciclo anterior venció: ciérralo antes de preparar otro':'Ya existe una invitación vigente: revisa o cierra su ciclo');
  const target=c&&!c.mergedInto?await base.inspectTarget(c._id,session):null;
  rows.push({...r,testData,name:c?.identification?.name||'Ficha ausente',reasons,eligible:!reasons.length,reviewRequired:!!c&&(!c.active||c.metadata?.dataStatus==='draft'||!!c.representatives?.length),fingerprint:target?.fingerprint||null});
 }
 return {rows,digest:hash(rows)};
}
async function prepare(input,actor){
 if(actor.role!=='admin')throw new HttpError(403,'FORBIDDEN','Se requiere administrador');
 return Invitation.db.transaction(async session=>{
 const plan=await preview(input.imports,session);if(plan.digest!==input.digest)throw new HttpError(409,'CAMPAIGN_CHANGED','Cambió la lista. Actualiza la vista previa.');
 const rows=plan.rows.filter(r=>input.keys.includes(r.key));if(rows.length!==input.keys.length||rows.some(r=>!r.eligible))throw new HttpError(400,'INVALID_SELECTION','Hay destinatarios excluidos');
 const ids=[];for(const r of rows){
 if(r.reviewRequired&&!input.reviewed.includes(r.key))throw new HttpError(400,'REVIEW_REQUIRED','Confirma la revisión de borradores, inactivas o equipos existentes');
 const target=await base.inspectTarget(r.churchId,session),row=new Invitation({reference:randomUUID(),church:r.churchId,recipient:{email:r.email},initialChannel:'make',contactKey:createHash('sha256').update(r.churchId+'\n'+r.email).digest('hex'),contactSource:{kind:'administrative_record',evidence:JSON.stringify(r.sources).slice(0,2000),recordedBy:actor._id},createdBy:actor._id,updatedBy:actor._id,lifecycle:'ready',expiresAt:new Date(Date.now()+30*86400000),delivery:{state:'not_sent'},response:{state:'awaiting_response'},targetReview:{state:'confirmed',fingerprint:target.fingerprint,name:target.name,active:target.active,teamSize:target.teamSize,reviewedBy:actor._id,reviewedAt:new Date()}});
 await base.lockContact(row,session);await row.save({session});await require('../models/church-outreach-event.model').create([{invitation:row._id,actor:actor._id,actorType:'admin',action:'created',to:'ready',reason:'Destinatario preparado exclusivamente para Make; sin enlace ni envío.',invitationVersion:row.version}],{session});await require('../models/church-make-message.model').create([{invitation:row._id,key:'initial:'+row.id,kind:'initial'}],{session});ids.push(row.id);
 }return {ids,count:ids.length,channel:'make',delivery:'not_sent'};
 });
}
module.exports={preview,prepare};
