const {createHash,randomUUID}=require('node:crypto'),Invitation=require('../models/church-outreach-invitation.model'),Contact=require('../models/church-outreach-contact.model'),Event=require('../models/church-outreach-event.model'),Church=require('../models/church.model'),{HttpError}=require('../utils/errors');
const live=['draft','ready'];
const transitions=Object.freeze({draft:['ready','expired','revoked','closed'],ready:['ready','expired','revoked','closed'],expired:['revoked','closed'],revoked:[],closed:[]});
const conflict=message=>new HttpError(409,'OUTREACH_CONFLICT',message),keyFor=(church,email)=>createHash('sha256').update(String(church)+'\n'+email).digest('hex');
function admin(actor){if(actor?.role!=='admin')throw new HttpError(403,'FORBIDDEN','Se requiere administración global');}
function checkVersion(row,version){if(!row)throw new HttpError(404,'NOT_FOUND','Invitación institucional no encontrada');if(row.version!==version)throw new HttpError(409,'STALE_VERSION','La invitación cambió. Recarga antes de guardar.');}
function move(row,to){if(!transitions[row.lifecycle]?.includes(to))throw conflict('La transición no está permitida en el estado actual.');row.lifecycle=to;row.active=live.includes(to);}
async function append(row,actor,action,from,reason,session){await Event.create([{invitation:row._id,actor:actor._id,action,from,to:row.lifecycle,reason,invitationVersion:row.version,churchVersion:row.targetReview?.churchVersion}],{session});}
async function lockContact(row,session){return Contact.findOneAndUpdate({_id:row.contactKey},{$setOnInsert:{church:row.church,email:row.recipient.email,noContact:false},$inc:{version:1}},{upsert:true,returnDocument:'after',session,runValidators:true});}
async function inspectTarget(churchId,session=null){
 const church=await Church.findById(churchId).select('identification.name location active metadata mergedInto representatives representativeRoles updatedAt __v').session(session).lean();
 if(!church)return {state:'missing',reason:'La iglesia vinculada ya no existe.'};
 if(church.mergedInto){const seen=new Set([String(church._id)]);let next=church.mergedInto;
  for(let hop=0;hop<50;hop++){if(seen.has(String(next)))return {state:'merge_conflict',reason:'La cadena de fusiones contiene un ciclo.'};seen.add(String(next));const c=await Church.findById(next).select('mergedInto').session(session).lean();if(!c)return {state:'merge_conflict',reason:'No se encontró la ficha principal.'};if(!c.mergedInto)return {state:'merged',reason:'La iglesia fue fusionada. Revoca esta invitación y revisa una nueva para la ficha principal.',suggestedChurchId:c._id};next=c.mergedInto;}
  return {state:'merge_conflict',reason:'La cadena de fusiones requiere revisión administrativa.'};
 }
 const team=(church.representatives||[]).map(id=>({user:String(id),subrole:church.representativeRoles?.find(p=>String(p.user)===String(id))?.subrole||'administrator'})).sort((a,b)=>a.user.localeCompare(b.user));
 const snapshot={id:String(church._id),name:church.identification?.name||'',location:church.location,active:church.active,metadata:church.metadata,version:church.__v,updatedAt:church.updatedAt,team};
 return {state:'available',churchVersion:church.metadata?.version||0,name:snapshot.name,location:{address:church.location?.address,commune:church.location?.commune,city:church.location?.city},active:!!church.active,teamSize:team.length,fingerprint:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
}
function readiness(row,target,contact){
 const expired=live.includes(row.lifecycle)&&row.expiresAt<=new Date();
 const effectiveLifecycle=expired?'expired':row.lifecycle;
 const reasons=[];if(!live.includes(effectiveLifecycle))reasons.push(effectiveLifecycle);
 if(contact?.noContact||row.noContact?.requested)reasons.push('no_contact');
 if(target.state!=='available')reasons.push(target.state);
 if(row.targetReview?.state!=='confirmed')reasons.push('target_not_reviewed');else if(target.fingerprint!==row.targetReview.fingerprint)reasons.push('target_changed');
 return {effectiveLifecycle,requiresTargetReview:target.state!=='available'||row.targetReview?.state!=='confirmed'||target.fingerprint!==row.targetReview?.fingerprint,blockedReasons:reasons,preparationReady:effectiveLifecycle==='ready'&&reasons.length===0,canSend:false};
}
async function create(data,actor){admin(actor);const now=new Date(),expiresAt=new Date(data.expiresAt),collectedAt=new Date(data.contactSource.collectedAt);
 if(expiresAt<=now||expiresAt>new Date(now.getTime()+90*86400000))throw new HttpError(400,'INVALID_EXPIRY','La vigencia debe ser futura y no superar 90 días.');
 if(collectedAt>now)throw new HttpError(400,'INVALID_SOURCE_DATE','La fecha de obtención del contacto no puede ser futura.');
 return Invitation.db.transaction(async session=>{
  const target=await inspectTarget(data.churchId,session);if(target.state!=='available')throw conflict(target.reason);
  const related=await Invitation.exists({active:true,expiresAt:{$gt:now},$or:[{church:data.churchId},{'recipient.email':data.recipient.email}]}).session(session);if(related&&!data.acknowledgeRelated)throw conflict('Existen ciclos vigentes relacionados. Revísalos y confirma antes de preparar otro.');
  const row=new Invitation({reference:randomUUID(),church:data.churchId,recipient:data.recipient,contactKey:keyFor(data.churchId,data.recipient.email),contactSource:{...data.contactSource,collectedAt,recordedBy:actor._id},createdBy:actor._id,updatedBy:actor._id,expiresAt,note:data.note,delivery:{state:'not_sent',updatedAt:now,attempts:0},response:{state:'awaiting_response'},targetReview:{state:'pending'},noContact:{requested:false}});
  const contact=await lockContact(row,session);if(contact.noContact)throw conflict('Este destinatario pidió no ser contactado para esta iglesia.');
  const prior=await Invitation.findOne({church:row.church,'recipient.email':row.recipient.email,active:true}).session(session);
  if(prior){if(prior.expiresAt>now)throw conflict('Ya existe una invitación vigente para esta iglesia y este destinatario.');const from=prior.lifecycle;move(prior,'expired');prior.version++;prior.updatedBy=actor._id;await prior.save({session});await append(prior,actor,'expired',from,'Vigencia cumplida antes de preparar otro ciclo.',session);}
  await row.save({session});await append(row,actor,'created',undefined,'Preparación administrativa; no se envió correo.',session);return row;
 });
}
async function act(id,version,data,actor){admin(actor);
 return Invitation.db.transaction(async session=>{
  const row=await Invitation.findById(id).session(session);checkVersion(row,version);const contact=await lockContact(row,session),from=row.lifecycle,now=new Date();let action;
  if(data.action==='review_target'){
   if(!live.includes(row.lifecycle)||row.expiresAt<=now||contact.noContact||row.noContact?.requested)throw conflict('La invitación venció, fue cerrada o tiene el contacto detenido.');
   const target=await inspectTarget(row.church,session);if(target.state!=='available')throw conflict(target.reason);
   if(!target.active&&!data.acknowledgeInactive)throw conflict('Revisa expresamente la inactividad; no se restaurará la iglesia.');
   if(target.teamSize&&!data.acknowledgeExistingTeam)throw conflict('Confirma que revisaste el equipo existente; no será sustituido.');
   row.targetReview={state:'confirmed',fingerprint:target.fingerprint,churchVersion:target.churchVersion,name:target.name,active:target.active,teamSize:target.teamSize,reviewedBy:actor._id,reviewedAt:now,reason:data.reason};move(row,'ready');action='target_reviewed';
  }else if(data.action==='expire'){
   if(!live.includes(row.lifecycle)||row.expiresAt>now)throw conflict('La invitación todavía no ha vencido o ya está cerrada.');move(row,'expired');action='expired';
  }else if(data.action==='revoke'){
   move(row,'revoked');row.revokedAt=now;row.revokedBy=actor._id;row.revocationReason=data.reason;action='revoked';
  }else if(data.action==='close'){
   move(row,'closed');row.closedAt=now;row.response.state='closed';action='closed';
  }else if(data.action==='no_contact'){
   contact.noContact=true;contact.recordedAt=now;contact.recordedBy=actor._id;contact.reason=data.reason;await contact.save({session});
   // An old invitation can report a withdrawal that must also stop the current cycle.
   const current=await Invitation.findOne({contactKey:row.contactKey,active:true,_id:{$ne:row._id}}).session(session);
   if(current){await require('./church-outreach-member.service').cancel(current,session);const previous=current.lifecycle;move(current,'revoked');current.noContact={requested:true,at:now,recordedBy:actor._id,reason:data.reason};current.revokedAt=now;current.revokedBy=actor._id;current.revocationReason=data.reason;current.updatedBy=actor._id;current.version++;await current.save({session});await append(current,actor,'no_contact_recorded',previous,data.reason,session);}
   row.noContact={requested:true,at:now,recordedBy:actor._id,reason:data.reason};if(live.includes(row.lifecycle)||row.lifecycle==='expired'){move(row,'revoked');row.revokedAt=now;row.revokedBy=actor._id;row.revocationReason=data.reason;}action='no_contact_recorded';
  }
  if(action!=='target_reviewed'){await require('./church-outreach-member.service').cancel(row,session);}
  if(!action)throw new HttpError(400,'INVALID_ACTION','Acción no permitida.');await require('../models/church-outreach-access.model').updateMany({invitation:row._id,revokedAt:null},{$set:{revokedAt:now}},{session});row.version++;row.updatedBy=actor._id;await row.save({session});await append(row,actor,action,from,data.reason,session);return row;
 });
}
async function detail(id){const row=await Invitation.findById(id);if(!row)throw new HttpError(404,'NOT_FOUND','Invitación institucional no encontrada');const [target,contact]=await Promise.all([inspectTarget(row.church),Contact.findById(row.contactKey)]);return {data:row,target,readiness:readiness(row,target,contact)};}
module.exports={create,act,detail,inspectTarget,readiness,transitions,lockContact};
