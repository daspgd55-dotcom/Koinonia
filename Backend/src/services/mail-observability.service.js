const Event=require('../models/mail-event.model'),Job=require('../models/mail-job.model'),{Webhook}=require('svix'),{HttpError}=require('../utils/errors');
const types=['email.sent','email.delivery_delayed','email.delivered','email.failed','email.bounced','email.complained'];
const priority=['email.complained','email.bounced','email.failed','email.delivered','email.delivery_delayed','email.sent'];
function status(events){return priority.find(type=>events.some(e=>e.type===type))||null;}
async function webhook(req,res){
 const cfg=req.app.locals.config;if(!cfg.mailWebhookSecret)throw new HttpError(503,'WEBHOOK_DISABLED','Webhook no configurado');
 let event;try{new Webhook(cfg.mailWebhookSecret).verify(req.body,{'svix-id':req.get('svix-id'),'svix-timestamp':req.get('svix-timestamp'),'svix-signature':req.get('svix-signature')});event=JSON.parse(req.body.toString('utf8'));}catch{throw new HttpError(400,'INVALID_SIGNATURE','Firma inválida');}
 if(!event||typeof event!=='object')throw new HttpError(400,'INVALID_EVENT','Evento inválido');
 if(!types.includes(event.type))return res.status(204).end();
 const id=req.get('svix-id'),providerId=event.data?.email_id,date=new Date(event.created_at);
 if(typeof id!=='string'||id.length>200||typeof providerId!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(providerId)||typeof event.created_at!=='string'||!Number.isFinite(date.getTime())||date>Date.now()+300000)throw new HttpError(400,'INVALID_EVENT','Evento inválido');
 try{await Event.updateOne({_id:id},{$setOnInsert:{providerId,type:event.type,occurredAt:date,source:cfg.mailWebhookSource||'provider',purgeAt:require('../config/retention').after(cfg,'eventDays')}},{upsert:true});}catch(e){if(e.code!==11000)throw e;}
 const tag=Array.isArray(event.data.tags)?event.data.tags.find(t=>t.name==='koinonia_message')?.value:event.data.tags?.koinonia_message;
 if(typeof tag==='string'&&/^[a-f0-9-]{36}$/.test(tag))await Job.updateOne({_id:tag,$or:[{providerId:{$exists:false}},{providerId}]},{$set:{providerId}});
 const OutreachMail=require('../models/church-outreach-mail.model');
 if(typeof tag==='string'&&/^[a-f0-9-]{36}$/.test(tag))await OutreachMail.updateOne({jobId:tag,$or:[{providerId:{$exists:false}},{providerId}]},{$set:{providerId}});
 const related=await OutreachMail.find({providerId}).select('jobId');for(const mail of related)await require('./church-outreach-mail-tracking.service').sync(mail.jobId);
 res.status(204).end();
}
async function recordDirect(id,patch,cfg={}){try{await Job.updateOne({_id:id},{$set:{transport:'direct',...(['accepted','failed'].includes(patch.state)?{purgeAt:require('../config/retention').after(cfg,'mailDays')} : {}),...patch}},{upsert:true});}catch{console.error('MAIL_OBSERVATION_UNAVAILABLE');}}
module.exports={webhook,status,types,recordDirect};
