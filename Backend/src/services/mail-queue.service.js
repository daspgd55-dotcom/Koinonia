const crypto=require('node:crypto'),User=require('../models/user.model'),Job=require('../models/mail-job.model');
const enabled=cfg=>cfg.securityPolicy?.mailQueueEnabled===true;
function configFromEnv(env){
 if(!env.MAIL_QUEUE_ENCRYPTION_KEYS&&!env.MAIL_QUEUE_ACTIVE_KEY_ID)return null;
 let keys;try{keys=JSON.parse(env.MAIL_QUEUE_ENCRYPTION_KEYS);}catch{throw Error('MAIL_QUEUE_ENCRYPTION_KEYS inválido');}
 if(!keys||Array.isArray(keys)||typeof keys!=='object'||!Object.hasOwn(keys,env.MAIL_QUEUE_ACTIVE_KEY_ID))throw Error('Configura las claves de la cola');
 for(const [id,key] of Object.entries(keys))if(!/^[a-zA-Z0-9_-]{1,40}$/.test(id)||typeof key!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32)throw Error('Clave de cola inválida');
 return {keys,activeKeyId:env.MAIL_QUEUE_ACTIVE_KEY_ID};
}
function validate(cfg){if(enabled(cfg)&&(!cfg.mail||!cfg.mailQueue))throw Error('Configura correo y cifrado antes de activar la cola');}
function seal(data,id,cfg){const k=cfg.mailQueue,iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',Buffer.from(k.keys[k.activeKeyId],'base64'),iv);c.setAAD(Buffer.from(id));const encrypted=Buffer.concat([c.update(JSON.stringify(data)),c.final()]);return [k.activeKeyId,iv.toString('base64'),c.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');}
function open(value,id,cfg){const [key,iv,tag,data]=value.split('.'),d=crypto.createDecipheriv('aes-256-gcm',Buffer.from(cfg.mailQueue.keys[key],'base64'),Buffer.from(iv,'base64'));d.setAAD(Buffer.from(id));d.setAuthTag(Buffer.from(tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(data,'base64')),d.final()]).toString());}
function entry(cfg,email,subject,text,guard=null){const id=crypto.randomUUID(),expiresAt=new Date(Math.min(guard?.expiresAt?.getTime()||Infinity,Date.now()+23*3600000));return {id,createdAt:new Date(),payload:seal({email,subject,text,from:cfg.mail.from,guard},id,cfg),expiresAt};}
function notice(cfg,email){return entry(cfg,email,'Tu contraseña de Koinonía cambió','Se cambió tu contraseña y se cerraron las sesiones anteriores. Si no reconoces este cambio, utiliza Recuperar contraseña desde Koinonía.');}
async function reconcile(){
 const users=await User.find({'mailOutbox.0':{$exists:true}}).select('+mailOutbox').limit(100);
 for(const u of users)for(const item of u.mailOutbox){
  try{await Job.updateOne({_id:item.id},{$setOnInsert:{payload:item.payload,expiresAt:item.expiresAt,createdAt:item.createdAt||new Date(),state:'pending',attempts:0,nextAttemptAt:new Date()}},{upsert:true});}catch(e){if(e.code!==11000)throw e;}
  await User.updateOne({_id:u._id},{$pull:{mailOutbox:{id:item.id}}});
 }
}
function retryAfter(value,now=Date.now()){if(!value)return 0;const n=Number(value);return Number.isFinite(n)?Math.max(0,n*1000):Math.max(0,Date.parse(value)-now)||0;}
async function deliver(cfg,data,id,fetcher=fetch){
 const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+cfg.mail.key,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:data.from,to:[data.email],subject:data.subject,text:data.text,tags:[{name:"koinonia_message",value:id}]}),signal:AbortSignal.timeout(10000)});
 if(r.ok){const body=await r.json().catch(()=>({}));return {ok:true,providerId:typeof body.id==='string'?body.id:undefined};}const body=await r.json().catch(()=>({}));
 return {ok:false,temporary:r.status===429||r.status===408||r.status>=500||(r.status===409&&body.name==='concurrent_idempotent_requests'),reason:r.status===429?'provider_rate_limit':r.status>=500?'provider_temporary':'provider_rejected',delay:retryAfter(r.headers?.get('retry-after'))};
}
async function runOne(cfg,{send=deliver,random=Math.random}={}){
 if(!enabled(cfg))return false;validate(cfg);const owner=crypto.randomUUID(),now=new Date();
 const job=await Job.findOneAndUpdate({transport:{$ne:'direct'},$or:[{state:{$in:['pending','retry']},nextAttemptAt:{$lte:now}},{state:'processing',leaseUntil:{$lte:now}}]},{$set:{state:'processing',owner,leaseUntil:new Date(Date.now()+60000)}},{sort:{nextAttemptAt:1},returnDocument:'after'}).select('+payload');if(!job)return false;
 const finish=async(state,failure,extra={})=>Job.updateOne({_id:job._id,owner,state:'processing'},{$set:{state,failure,...extra,...(['accepted','failed','obsolete'].includes(state)?{purgeAt:require('../config/retention').after(cfg,'mailDays')}:{})},$unset:{owner:1,leaseUntil:1,...(['accepted','failed','obsolete'].includes(state)?{payload:1}:{})}});
 const providerConfirmed=async()=>{const current=await Job.findById(job._id).select('providerId');return current?.providerId&&await require('../models/mail-event.model').findOne({providerId:current.providerId}).select('source');};
 let evidence=await providerConfirmed();if(evidence){await finish('accepted','provider_status_available',{source:evidence.source});return true;}
 if(job.expiresAt<=now){await finish('obsolete','expired');return true;}
 if(job.attempts>=6){await finish('failed','attempts_exhausted');return true;}
 let data;try{data=open(job.payload,job._id,cfg);}catch{await finish('retry','encryption_unavailable',{nextAttemptAt:new Date(Date.now()+300000)});return true;}
 if(data.guard){const g=data.guard;if(!await User.exists({_id:g.user,active:true,[g.field+'.hash']:g.hash,[g.field+'.expiresAt']:{$gt:new Date()}})){await finish('obsolete','link_replaced_or_consumed');return true;}}
 try{await require('./account-security.service').quota(cfg,'mail-global','all',100,3600000);}catch{await finish('retry','delivery_quota_unavailable',{nextAttemptAt:new Date(Date.now()+3600000)});return true;}
 if(job.expiresAt<=new Date()){await finish('obsolete','expired');return true;}
 if(data.guard){const g=data.guard;if(!await User.exists({_id:g.user,active:true,[g.field+'.hash']:g.hash,[g.field+'.expiresAt']:{$gt:new Date()}})){await finish('obsolete','link_replaced_or_consumed');return true;}}
 evidence=await providerConfirmed();if(evidence){await finish('accepted','provider_status_available',{source:evidence.source});return true;}
 const owned=await Job.updateOne({_id:job._id,owner,state:'processing',leaseUntil:{$gt:new Date()}},{$inc:{attempts:1},$set:{source:send===deliver?'provider':'simulated'}});if(!owned.modifiedCount)return true;
 let result;try{result=await send(cfg,data,job._id);}catch{result={ok:false,temporary:true,reason:'network_or_timeout',delay:0};}
 if(result.ok){await finish('accepted','',{acceptedAt:new Date(),...(result.providerId?{providerId:result.providerId}:{})});return true;}
 const delay=Math.max(result.delay||0,Math.min(3600000,30000*2**job.attempts)*(0.5+random())),next=new Date(Date.now()+Math.min(delay,7*86400000));
 await finish(!result.temporary||job.attempts+1>=6?'failed':next>=job.expiresAt?'obsolete':'retry',result.reason,{nextAttemptAt:next});return true;
}
module.exports={enabled,configFromEnv,validate,entry,notice,reconcile,runOne,deliver,retryAfter,open};
