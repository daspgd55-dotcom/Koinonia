const {createHash,randomUUID}=require('node:crypto'),Import=require('../models/church-contact-import.model'),Church=require('../models/church.model'),Invitation=require('../models/church-outreach-invitation.model'),Contact=require('../models/church-outreach-contact.model'),Event=require('../models/church-outreach-event.model'),MakeMessage=require('../models/church-make-message.model'),base=require('./church-outreach.service'),mail=require('./church-outreach-mail.service'),{HttpError}=require('../utils/errors'),{z}=require('../validation/schemas');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),contactKey=(church,email)=>createHash('sha256').update(String(church)+'\n'+email).digest('hex');
async function preview(ids,session=null){
 const batches=await Import.find({_id:{$in:ids}}).sort({_id:1}).session(session).lean(),map=new Map();
 for(const b of batches)for(const a of b.associations)for(const raw of a.recipients){const email=raw.trim().toLowerCase(),key=String(a.church)+'|'+email;if(!map.has(key))map.set(key,{key,churchId:String(a.church),email,sources:[]});map.get(key).sources.push({batch:String(b._id),source:b.source,row:a.sourceRow});}
 const values=[...map.values()];if(!values.length)return {rows:[],digest:hash([])};
 const churchIds=[...new Set(values.map(r=>r.churchId))],emails=[...new Set(values.map(r=>r.email))],pairs=values.map(r=>({church:r.churchId,email:r.email}));
 const [churches,priorInvites,suppressed]=await Promise.all([
  Church.find({_id:{$in:churchIds}}).select('identification.name location active metadata mergedInto representatives representativeRoles updatedAt __v').session(session).lean(),
  Invitation.find({$or:values.map(r=>({church:r.churchId,'recipient.email':r.email})),active:true,lifecycle:{$in:['draft','ready']}}).select('church recipient.email expiresAt').sort({createdAt:-1}).session(session).lean(),
  mail.suppressedMany(pairs,session)
 ]);
 const churchById=new Map(churches.map(c=>[String(c._id),c])),priorByKey=new Map();for(const p of priorInvites){const key=String(p.church)+'|'+p.recipient.email;if(!priorByKey.has(key))priorByKey.set(key,p);}
 const rows=[];for(const r of values){const c=churchById.get(r.churchId),prior=priorByKey.get(r.key),reasons=[];if(!z.string().email().safeParse(r.email).success)reasons.push('Correo inválido');if(!c||c.mergedInto)reasons.push('Ficha ausente o fusionada');const testData=!!(c?.metadata?.testData||c?.testOnly||c?.importInfo?.batchId?.includes('synthetic'));if(suppressed.get(r.key))reasons.push('Contacto detenido');if(prior)reasons.push(prior.expiresAt<=new Date()?'El ciclo anterior venció: ciérralo antes de preparar otro':'Ya existe una invitación vigente: revisa o cierra su ciclo');const target=c&&!c.mergedInto?base.targetFromChurch(c):null;
  rows.push({...r,testData,name:c?.identification?.name||'Ficha ausente',reasons,eligible:!reasons.length,reviewRequired:!!c&&(!c.active||c.metadata?.dataStatus==='draft'||!!c.representatives?.length),fingerprint:target?.fingerprint||null,targetName:target?.name,targetActive:target?.active,teamSize:target?.teamSize});
 }
 return {rows,digest:hash(rows)};
}
async function prepare(input,actor){
 if(actor.role!=='admin')throw new HttpError(403,'FORBIDDEN','Se requiere administrador');
 return Invitation.db.transaction(async session=>{
  const plan=await preview(input.imports,session);if(plan.digest!==input.digest)throw new HttpError(409,'CAMPAIGN_CHANGED','Cambió la lista. Actualiza la vista previa.');
  const rows=plan.rows.filter(r=>input.keys.includes(r.key));if(rows.length!==input.keys.length||rows.some(r=>!r.eligible))throw new HttpError(400,'INVALID_SELECTION','Hay destinatarios excluidos');
  for(const r of rows)if(r.reviewRequired&&!input.reviewed.includes(r.key))throw new HttpError(400,'REVIEW_REQUIRED','Confirma la revisión de borradores, inactivas o equipos existentes');
  const expiresAt=new Date(Date.now()+30*86400000),docs=rows.map(r=>new Invitation({reference:randomUUID(),church:r.churchId,recipient:{email:r.email},initialChannel:'make',contactKey:contactKey(r.churchId,r.email),contactSource:{kind:'administrative_record',evidence:JSON.stringify(r.sources).slice(0,2000),recordedBy:actor._id},createdBy:actor._id,updatedBy:actor._id,lifecycle:'ready',expiresAt,delivery:{state:'not_sent'},response:{state:'awaiting_response'},targetReview:{state:'confirmed',fingerprint:r.fingerprint,name:r.targetName,active:r.targetActive,teamSize:r.teamSize,reviewedBy:actor._id,reviewedAt:new Date()}}));
  await Contact.bulkWrite(docs.map(row=>({updateOne:{filter:{_id:row.contactKey},update:{$setOnInsert:{church:row.church,email:row.recipient.email,noContact:false},$inc:{version:1}},upsert:true}})),{session,ordered:true});
  const locked=await Contact.find({_id:{$in:docs.map(d=>d.contactKey)}}).select('_id noContact').session(session).lean();if(locked.some(c=>c.noContact))throw new HttpError(409,'CAMPAIGN_CHANGED','Un contacto detuvo las comunicaciones. Actualiza la vista previa antes de continuar.');
  const created=await Invitation.insertMany(docs,{session,ordered:true});
  await Event.insertMany(created.map(row=>({invitation:row._id,actor:actor._id,actorType:'admin',action:'created',to:'ready',reason:'Destinatario preparado exclusivamente para Make; sin enlace ni envío.',invitationVersion:row.version})),{session,ordered:true});
  await MakeMessage.insertMany(created.map(row=>({invitation:row._id,key:'initial:'+String(row._id),kind:'initial'})),{session,ordered:true});
  return {ids:created.map(row=>String(row._id)),count:created.length,channel:'make',delivery:'not_sent'};
 });
}
module.exports={preview,prepare};
