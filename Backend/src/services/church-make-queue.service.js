const {randomBytes}=require('node:crypto'),Message=require('../models/church-make-message.model'),Invitation=require('../models/church-outreach-invitation.model'),Access=require('../models/church-outreach-access.model'),Church=require('../models/church.model'),base=require('./church-outreach.service'),mail=require('./church-outreach-mail.service'),queue=require('./mail-queue.service'),{hash}=require('./account-security.service'),{HttpError}=require('../utils/errors');
async function eligible(row,session){
 if(!row||row.initialChannel!=='make'||row.lifecycle!=='ready'||row.expiresAt<=new Date()||row.noContact?.requested||!['awaiting_response','needs_clarification'].includes(row.response.state))return false;
 const c=await Church.findById(row.church).session(session).lean();if(!c||c.mergedInto||c.metadata?.testData||c.testOnly||c.importInfo?.batchId?.includes('synthetic')||await mail.suppressed(row.church,row.recipient.email,session))return false;
 const target=await base.inspectTarget(row.church,session),contact=await base.lockContact(row,session);return base.readiness(row,target,contact).preparationReady;
}
async function prepare(id,cfg){
 if(!cfg.mailQueue||!cfg.mail?.appUrl||!/^https:\/\//.test(cfg.mail.appUrl))throw new HttpError(409,'QUEUE_CONFIG','Configura el cifrado de cola y el origen HTTPS del frontend');
 return Message.db.transaction(async session=>{
 const m=await Message.findById(id).session(session);if(!m)throw new HttpError(404,'NOT_FOUND','Mensaje no encontrado');
 const row=await Invitation.findById(m.invitation).session(session);
 if(!await eligible(row,session)){m.state='cancelled';m.payload=undefined;m.reason='Invitación no disponible';await m.save({session});return m;}
 if(m.state==='prepared'&&(m.expiresAt<=new Date()||!await Access.exists({_id:m.access,revokedAt:null,consumedAt:null,expiresAt:{$gt:new Date()}}).session(session))){m.state='cancelled';m.payload=undefined;m.reason='Mensaje vencido o enlace no disponible';await m.save({session});return m;}
 if(m.state!=='pending')return m;
 const raw=randomBytes(32).toString('hex'),expiresAt=new Date(Math.min(Date.now()+7*86400000,row.expiresAt.getTime()));
 await Access.updateMany({invitation:row._id,revokedAt:null},{$set:{revokedAt:new Date()}},{session});
 const [access]=await Access.create([{invitation:row._id,tokenHash:hash(raw),purpose:'institutional_link',expiresAt}],{session});
 const church=await Church.findById(row.church).session(session),content=require('./church-outreach-mail-templates').render({kind:'institutional',church,source:row.contactSource.kind,link:cfg.mail.appUrl.replace(/\/$/,'')+'/#/invitacion-iglesia?token='+raw,reminder:false});
 const entry=queue.entry(cfg,row.recipient.email,content.subject,content.text,{expiresAt},content.html);
 m.payload=entry.payload;m.payloadId=entry.id;m.expiresAt=entry.expiresAt;m.access=access._id;m.state='prepared';await m.save({session});row.lastLinkIssuedAt=new Date();row.version++;await row.save({session});return m;
 });
}
const response={message:'Si el enlace vencido permite renovación, la solicitud quedó registrada para el correo original. No se ha enviado un correo todavía.'};
async function renew(token){
 if(!/^[a-f0-9]{64}$/.test(token))return response;
 await Message.db.transaction(async session=>{
 const access=await Access.findOne({tokenHash:hash(token),purpose:'institutional_link',revokedAt:null,expiresAt:{$lte:new Date()}}).session(session);if(!access)return;
 const row=await Invitation.findById(access.invitation).session(session);if(!await eligible(row,session))return;
 if(await Message.exists({invitation:row._id,state:{$in:['pending','prepared','reserved','uncertain']},$or:[{expiresAt:{$gt:new Date()}},{expiresAt:{$exists:false}}]}).session(session))return;
 await Message.updateOne({key:'renewal:'+access.id},{$setOnInsert:{invitation:row._id,kind:'renewal',state:'pending'}},{upsert:true,session});
 });return response;
}
module.exports={prepare,renew};
