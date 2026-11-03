const Invitation=require('../models/church-outreach-invitation.model'),Church=require('../models/church.model'),User=require('../models/user.model'),Event=require('../models/church-outreach-event.model'),Access=require('../models/church-outreach-access.model'),base=require('./church-outreach.service'),{HttpError}=require('../utils/errors');
const fail=message=>new HttpError(409,'OUTREACH_CONFLICT',message);
async function context(id){const result=await base.detail(id),church=await Church.findById(result.data.church).select('identification.name location.address location.commune location.city contact active metadata mergedInto representatives representativeRoles').lean();
 const users=church?await User.find({_id:{$in:church.representatives||[]}}).select('name email active role').lean():[];
 const members=await require('../models/church-outreach-member.model').find({invitation:id}).lean();const mails=await require('../models/church-outreach-mail.model').find({invitation:id}).sort({createdAt:-1}).limit(100).lean();return {...result,church,mails,members:members.map(m=>({...m,effectiveState:m.active&&m.expiresAt<=new Date()?'expired':m.state})),team:users.map(u=>({...u,subrole:church.representativeRoles?.find(r=>String(r.user)===String(u._id))?.subrole||'administrator'}))};
}
async function review(id,version,data,actor,config,command){if(actor?.role!=='admin')throw new HttpError(403,'FORBIDDEN','Se requiere administración global');const memberSvc=require('./church-outreach-member.service'),hash=require('./account-security.service').hash,commandKey=hash(String(actor._id)+':'+id+':'+command),commandHash=hash(JSON.stringify({version,data}));
 const replay=async session=>{const event=await Event.findOne({commandKey}).session(session);if(!event)return null;if(event.commandHash!==commandHash)throw fail('Esta clave de operación ya se usó con otros datos.');return Invitation.findById(id).session(session);};
 const previous=await replay(null);if(previous)return previous;
 try{return await Invitation.db.transaction(async session=>{const previous=await replay(session);if(previous)return previous;
 const row=await Invitation.findById(id).session(session);if(!row||row.version!==version)throw new HttpError(409,'STALE_VERSION','La invitación cambió. Actualiza el contexto y contrasta tu borrador antes de reintentar.');
 const contact=await base.lockContact(row,session),now=new Date(),from=row.lifecycle;
 if(!row.active||row.expiresAt<=now||contact.noContact||row.noContact?.requested)throw fail('Este ciclo está cerrado, vencido o sin permiso de contacto.');
 if(!['received','needs_clarification','approved'].includes(row.response?.state))throw fail('Primero debe recibirse una propuesta.');
 let action,decisions=[];
 if(data.action==='clarify'){
  if(row.proposedRepresentatives.some(p=>p.acceptanceState==='accepted'||p.activationState==='active'))throw fail('No se puede reabrir una propuesta con accesos aceptados o activos.');
  if(row.communications.length>=100)throw fail('Se alcanzó el límite de comunicaciones de este ciclo.');
  row.communications.push({kind:'clarification',text:data.message,state:'prepared',at:now,by:actor._id});row.response.state='needs_clarification';row.review={state:'clarification',reason:data.reason,at:now,by:actor._id};
  for(const p of row.proposedRepresentatives){p.reviewState='pending';p.approvedSubrole=undefined;p.reviewReason=undefined;p.reviewedAt=undefined;p.reviewedBy=undefined;p.activationState='not_started';p.acceptanceState='not_requested';}action='clarification_requested';
 }else if(data.action==='reject'){
  if(row.proposedRepresentatives.some(p=>p.activationState==='active'||p.acceptanceState==='accepted'))throw fail('Gestiona los accesos activos desde el equipo; no se retiran aquí.');
  for(const p of row.proposedRepresentatives){p.reviewState='rejected';p.approvedSubrole=undefined;p.reviewReason=data.reason;p.reviewedAt=now;p.reviewedBy=actor._id;p.activationState='not_started';p.acceptanceState='not_requested';decisions.push({email:p.email,state:'rejected'});}
  row.review={state:'rejected',reason:data.reason,at:now,by:actor._id};row.response.state='rejected';row.lifecycle='closed';row.closedAt=now;row.active=false;action='proposal_rejected';
 }else{
  if(row.response.state==='needs_clarification')throw fail('Espera la respuesta a la aclaración antes de aprobar.');
  const target=await base.inspectTarget(row.church,session);if(!base.readiness(row,target,contact).preparationReady||data.targetFingerprint!==target.fingerprint)throw fail('La iglesia o el equipo cambiaron. Actualiza el contexto y revisa el destino antes de aprobar.');
  for(const decision of data.people){const p=row.proposedRepresentatives.find(p=>p.email===decision.email);if(!p)throw fail('La persona ya no forma parte de esta propuesta.');if(p.acceptanceState==='accepted'||p.activationState==='active')throw fail('No se cambia una asignación aceptada o activa desde esta revisión.');
   p.reviewState=decision.state;p.approvedSubrole=decision.state==='approved'?decision.subrole:undefined;p.reviewReason=data.reason;p.reviewedAt=now;p.reviewedBy=actor._id;p.activationState=decision.state==='approved'?'pending':'not_started';p.acceptanceState='not_requested';decisions.push({email:p.email,state:p.reviewState,subrole:p.approvedSubrole});
  }
  const all=row.proposedRepresentatives.every(p=>(p.reviewState||'pending')!=='pending'),any=row.proposedRepresentatives.some(p=>p.reviewState==='approved');row.review={state:all?(any?'approved':'rejected'):'partial',reason:data.reason,at:now,by:actor._id};row.response.state=all?(any?'approved':'rejected'):'received';if(all&&!any){row.lifecycle='closed';row.active=false;row.closedAt=now;}action='people_reviewed';
 }
 if(data.action==='people'){await memberSvc.prepare(row,data.people,actor,config,session);decisions=data.people.map(d=>({email:d.email,state:d.state,subrole:row.proposedRepresentatives.find(p=>p.email===d.email)?.approvedSubrole,requestedSubrole:d.subrole,changeExistingRole:d.changeExistingRole}));}else await memberSvc.cancel(row,session);
 await Access.updateMany({invitation:row._id,revokedAt:null},{$set:{revokedAt:now}},{session});row.updatedBy=actor._id;row.version++;await row.save({session});
 await Event.create([{invitation:row._id,actor:actor._id,actorType:'admin',action,commandKey,commandHash,reason:data.reason,decisions,from,to:row.lifecycle,responseState:row.response.state,invitationVersion:row.version,churchVersion:row.targetReview?.churchVersion}],{session});return row;
});}catch(error){if(error.code===11000){const completed=await replay(null);if(completed)return completed;}throw error;}
}
module.exports={context,review};
