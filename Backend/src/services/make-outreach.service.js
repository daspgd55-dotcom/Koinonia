const {randomBytes}=require('node:crypto'),Message=require('../models/church-make-message.model'),Invitation=require('../models/church-outreach-invitation.model'),Access=require('../models/church-outreach-access.model'),queue=require('./mail-queue.service'),base=require('./church-make-queue.service'),{hash}=require('./account-security.service'),{HttpError}=require('../utils/errors');
const conflict=()=>new HttpError(409,'RESERVATION_UNAVAILABLE','Reserva no disponible');
async function valid(m,session){const row=await Invitation.findById(m.invitation).session(session);return !m.trashedAt&&m.expiresAt>new Date()&&await base.eligible(row,session)&&!!await Access.exists({_id:m.access,revokedAt:null,consumedAt:null,expiresAt:{$gt:new Date()}}).session(session);}
async function claim(cfg){
 await Message.updateMany({state:'reserved',reservedUntil:{$lte:new Date()}},{$set:{state:'uncertain',reason:'Reserva vencida: comprobar Gmail antes de reenviar'}});
 const pending=await Message.findOne({trashedAt:null,state:'pending'}).sort({createdAt:1});if(pending)try{await base.prepare(pending.id,cfg);}catch(e){if(e.code!=='INVITATION_UNAVAILABLE')throw e;await Message.updateOne({_id:pending.id,state:'pending'},{$set:{state:'cancelled',reason:e.message},$unset:{payload:1}});}
 return Message.db.transaction(async session=>{
 const m=await Message.findOne({trashedAt:null,state:'prepared',expiresAt:{$gt:new Date()}}).sort({createdAt:1}).select('+payload').session(session);if(!m)return {messages:[]};
 if(!await valid(m,session)){m.state='cancelled';m.payload=undefined;await m.save({session});return {messages:[]};}
 const content=queue.open(m.payload,m.payloadId,cfg),token=randomBytes(32).toString('hex');m.state='reserved';m.reservationHash=hash(token);m.reservedUntil=new Date(Date.now()+10*60000);await m.save({session});
 return {messages:[{dispatchId:m.id,reservationToken:token,to:content.email,subject:content.subject,text:content.text,html:content.html||content.text,expiresAt:m.reservedUntil}]};
 });
}
async function check(input){return Message.db.transaction(async session=>{
 const m=await Message.findOne({_id:input.dispatchId,reservationHash:hash(input.reservationToken)}).session(session);
 if(!m||m.state!=='reserved'||m.reservedUntil<=new Date()||m.checkedAt)return {allowed:false};
 if(!await valid(m,session)){m.state='cancelled';m.payload=undefined;await m.save({session});return {allowed:false};}
 m.checkedAt=new Date();await m.save({session});return {allowed:true};
});}
async function result(input){return Message.db.transaction(async session=>{
 const m=await Message.findOne({_id:input.dispatchId,reservationHash:hash(input.reservationToken)}).session(session);if(!m)throw conflict();
 if(m.resultAt){if(m.state!==input.status||m.providerId!==(input.providerId||undefined))throw conflict();return {recorded:true,state:m.state};}
 if(!['reserved','uncertain'].includes(m.state)||!m.checkedAt)throw conflict();
 m.state=input.status;m.providerId=input.providerId;m.resultAt=new Date();m.payload=undefined;await m.save({session});
 if(input.status==='accepted')await Invitation.updateOne({_id:m.invitation},{$set:{'delivery.state':'accepted','delivery.providerId':input.providerId,'delivery.updatedAt':new Date()}}).session(session);
 return {recorded:true,state:m.state};
});}
module.exports={claim,check,result};
