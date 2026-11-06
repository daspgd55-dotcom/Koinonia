const {randomBytes}=require('node:crypto'),Access=require('../models/church-outreach-access.model'),Invitation=require('../models/church-outreach-invitation.model'),Event=require('../models/church-outreach-event.model'),base=require('./church-outreach.service'),{hash}=require('./account-security.service'),{HttpError}=require('../utils/errors');
const unavailable=()=>new HttpError(400,'INVITATION_UNAVAILABLE','No se puede usar este acceso. Solicita un nuevo enlace a quien te invitó.');
async function audit(row,action,session,actor){await Event.create([{invitation:row._id,actor:actor?._id,actorType:actor?'admin':'recipient',action,responseState:row.response.state,invitationVersion:row.version,to:row.lifecycle}],{session});}
async function invalidate(id,session){await Access.updateMany({invitation:id,revokedAt:null},{$set:{revokedAt:new Date()}},{session});}
async function mint(row,purpose,milliseconds,session){const token=randomBytes(32).toString('hex'),expiresAt=new Date(Math.min(Date.now()+milliseconds,row.expiresAt.getTime()));await Access.create([{invitation:row._id,tokenHash:hash(token),purpose,expiresAt}],{session});return {token,expiresAt};}
async function usable(row,session,{checkTarget=true}={}){
 if(!row||row.lifecycle!=='ready'||row.expiresAt<=new Date()||row.noContact?.requested||!['awaiting_response','needs_clarification'].includes(row.response?.state))throw unavailable();
 const contact=await base.lockContact(row,session);if(contact.noContact)throw unavailable();
 if(checkTarget){const target=await base.inspectTarget(row.church,session);if(!base.readiness(row,target,contact).preparationReady)throw unavailable();return target;}
}
async function credential(token,purpose,session){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw unavailable();
 const access=await Access.findOne({tokenHash:hash(token),purpose,revokedAt:null,consumedAt:null,expiresAt:{$gt:new Date()}}).session(session);if(!access)throw unavailable();
 const row=await Invitation.findById(access.invitation).session(session);return {access,row};
}
async function issue(id,version,actor){
 if(actor?.role!=='admin')throw new HttpError(403,'FORBIDDEN','Se requiere administración global');
 return Invitation.db.transaction(async session=>{
  const row=await Invitation.findById(id).session(session);if(!row||row.version!==version)throw new HttpError(409,'STALE_VERSION','Recarga la invitación antes de emitir otro enlace.');
  await usable(row,session);if(row.lastLinkIssuedAt&&Date.now()-row.lastLinkIssuedAt.getTime()<60000)throw new HttpError(429,'RATE_LIMIT','Espera un minuto antes de renovar el enlace.');
  await invalidate(row._id,session);const result=await mint(row,'institutional_link',7*86400000,session);row.lastLinkIssuedAt=new Date();row.version++;row.updatedBy=actor._id;await row.save({session});await audit(row,'link_issued',session,actor);
  return {path:'/#/invitacion-iglesia?token='+result.token,expiresAt:result.expiresAt,version:row.version,delivery:'not_sent'};
 });
}
async function begin(token){return Invitation.db.transaction(async session=>{
 const {access,row}=await credential(token,'institutional_link',session),target=await usable(row,session);
 access.consumedAt=new Date();await access.save({session});const result=await mint(row,'institutional_session',30*60000,session);
 row.version++;await row.save({session});await audit(row,'access_started',session);
 // Explicit allowlist: no contacts, coordinates, internal notes or team.
 return {sessionToken:result.token,expiresAt:result.expiresAt,church:{name:target.name,location:target.location},legal:require('../config/church-outreach-legal').current(),clarification:row.response.state==='needs_clarification'?row.communications?.at(-1)?.text:undefined};
});}
async function respond(token,answer,submission){return Invitation.db.transaction(async session=>{
 const {row}=await credential(token,'institutional_session',session);await usable(row,session,{checkTarget:answer==='received'});const now=new Date();
 if(answer==='received'){
  const legal=require('../config/church-outreach-legal').current();
  if(!legal.enabled)throw new HttpError(409,'LEGAL_PENDING','La recepción de solicitudes está pendiente de los textos definitivos de términos y privacidad. Tus respuestas no se han enviado.');
  if(!submission||submission.consent.revision!==legal.revision)throw new HttpError(409,'LEGAL_CHANGED','Los documentos cambiaron. Solicita un nuevo enlace para revisarlos; conserva tus respuestas antes de salir.');
  if(!submission.representatives?.some(p=>p.proposedSubrole==='administrator'))throw new HttpError(400,'ADMINISTRATOR_REQUIRED','Incluye un representante administrador antes de enviar la propuesta.');
  row.review={state:'pending'};row.response.respondent=submission.respondent;row.respondentParticipates=submission.participates;row.proposedRepresentatives=submission.representatives;
  if(!legal.testBypass&&(!submission.consent.terms||!submission.consent.privacy))throw new HttpError(400,'CONSENT_REQUIRED','Acepta los términos y la política de privacidad.');
  row.consent={acceptedAt:now,revision:legal.revision,testBypass:!!legal.testBypass,termsVersion:legal.terms?.version,privacyVersion:legal.privacy?.version,termsText:legal.terms?.text,privacyText:legal.privacy?.text,authorized:true,communications:true,advertising:false,purpose:row.purpose};
 }
 row.response.state=answer==='no_contact'?'declined':answer;row.response.submittedAt=now;
 row.lifecycle=answer==='received'?'ready':answer==='no_contact'?'revoked':'closed';row.active=answer==='received';if(!row.active)row.closedAt=now;
 if(answer==='no_contact'){const contact=await base.lockContact(row,session);contact.noContact=true;contact.recordedAt=now;contact.reason='Solicitud explícita desde sesión institucional';await contact.save({session});row.noContact={requested:true,at:now,reason:contact.reason};row.revokedAt=now;row.revocationReason=contact.reason;}
 await invalidate(row._id,session);row.version++;await row.save({session});await audit(row,answer==='no_contact'?'no_contact_recorded':'response_recorded',session);
 return {message:'Tu respuesta quedó registrada. No se han concedido permisos.'};
});}
module.exports={issue,begin,respond};
