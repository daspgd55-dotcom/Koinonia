const Job=require('../models/mail-job.model'),Event=require('../models/mail-event.model'),User=require('../models/user.model'),queue=require('../services/mail-queue.service'),{status}=require('../services/mail-observability.service'),{HttpError}=require('../utils/errors');
async function eligible(job,cfg){
 if(!queue.enabled(cfg)||job.transport==='direct'||job.state!=='retry'||job.attempts>=6||job.manualRetries>=3||job.expiresAt<=new Date()||job.nextAttemptAt>new Date()||job.lastManualRetryAt>Date.now()-60000||!job.payload)return false;
 if(job.providerId&&await Event.exists({providerId:job.providerId}))return false;
 try{const data=queue.open(job.payload,job._id,cfg),g=data.guard;return await queue.guardValid(g,cfg);}catch{return false;}
}
exports.list=async(req,res)=>{
 res.set('Cache-Control','no-store');const cfg=req.app.locals.config,page=Math.max(1,Math.min(10000,parseInt(req.query.page)||1)),filter={};
 if(req.query.state){if(!['pending','processing','retry','accepted','failed','obsolete','direct_pending'].includes(req.query.state))throw new HttpError(400,'INVALID_FILTER','Estado inválido');filter.state=req.query.state;}
 const [jobs,total,volumes,eventVolumes,outbox]=await Promise.all([
  Job.find(filter).sort({createdAt:-1,_id:-1}).skip((page-1)*20).limit(20).select('+payload +audit').lean(),Job.countDocuments(filter),
  Job.aggregate([{$group:{_id:{state:'$state',source:'$source'},count:{$sum:1},attempts:{$sum:'$attempts'},retries:{$sum:{$max:[0,{$subtract:['$attempts',1]}]}},oldest:{$min:'$createdAt'},meanAcceptanceMs:{$avg:{$subtract:['$acceptedAt','$createdAt']}}}}]),
  Event.aggregate([{$group:{_id:{providerId:'$providerId',type:'$type',source:'$source'}}},{$group:{_id:{type:'$_id.type',source:'$_id.source'},count:{$sum:1}}}]),
  User.aggregate([{$unionWith:{coll:require('../models/visit.model').collection.name}},{$match:{'mailOutbox.0':{$exists:true}}},{$project:{n:{$size:'$mailOutbox'},oldest:{$min:'$mailOutbox.createdAt'}}},{$group:{_id:null,count:{$sum:'$n'},oldest:{$min:'$oldest'}}}])
 ]);
 const events=await Event.aggregate([{$match:{providerId:{$in:jobs.map(j=>j.providerId).filter(Boolean)}}},{$group:{_id:{providerId:'$providerId',type:'$type',source:'$source'},occurredAt:{$max:'$occurredAt'}}},{$project:{_id:0,providerId:'$_id.providerId',type:'$_id.type',source:'$_id.source',occurredAt:1}}]);
 const data=await Promise.all(jobs.map(async j=>({id:j._id,transport:j.transport,source:j.source,state:j.state,providerId:j.providerId||null,providerStatus:status(events.filter(e=>e.providerId===j.providerId)),events:events.filter(e=>e.providerId===j.providerId),attempts:j.attempts,failure:j.failure||null,createdAt:j.createdAt,nextAttemptAt:j.nextAttemptAt,expiresAt:j.expiresAt,canRetry:await eligible(j,cfg),manualRetries:j.manualRetries||0,audit:(j.audit||[]).map(a=>({actor:a.actor,at:a.at,action:a.action}))})));
 res.json({data,page,total,metrics:{volumes,eventVolumes,outboxPending:outbox[0]?.count||0,outboxOldest:outbox[0]?.oldest||null},configuration:{queueEnabled:queue.enabled(cfg),webhookConfigured:!!cfg.mailWebhookSecret,emailVerificationRequired:!cfg.verificationPaused,captchaMode:cfg.securityPolicy.captchaMode,advancedAbuseMode:cfg.securityPolicy.advancedAbuseMode},retentionDays:require('../config/retention').settings(cfg).mailDays});
};
exports.retry=async(req,res)=>{
 res.set('Cache-Control','no-store');const cfg=req.app.locals.config;await require('../services/account-security.service').quota(cfg,'mail-admin-retry',String(req.user._id),10,3600000);
 const job=await Job.findById(req.params.id).select('+payload');if(!job||!await eligible(job,cfg))throw new HttpError(409,'MAIL_NOT_ELIGIBLE','No se puede reintentar: revisa vigencia, espera pendiente, estado y límites.');
 const result=await Job.updateOne({_id:job.id,state:'retry',updatedAt:job.updatedAt,attempts:job.attempts,expiresAt:{$gt:new Date()}},{$set:{nextAttemptAt:new Date(),lastManualRetryAt:new Date()},$inc:{manualRetries:1},$push:{audit:{$each:[{actor:req.user._id,at:new Date(),action:'retry_requested'}],$slice:-20}}});
 if(!result.modifiedCount)throw new HttpError(409,'MAIL_CHANGED','El trabajo cambió. Actualiza el panel.');
 res.json({message:'Reintento en cola. El worker comprobará nuevamente la vigencia antes de enviarlo.'});
};
exports.eligible=eligible;
