const {randomUUID}=require('node:crypto'),User=require('../models/user.model'),Mfa=require('../models/mfa.model'),Limit=require('../models/security-limit.model'),Risk=require('../models/abuse-counter.model'),Captcha=require('../models/captcha-use.model'),Job=require('../models/mail-job.model'),Event=require('../models/mail-event.model'),{Lock,Run}=require('../models/maintenance.model'),retention=require('../config/retention');
function plans(cfg,now){const r=retention.settings(cfg),before=(n,unit)=>new Date(now-n*unit),expired=(grace,unit)=>({expiresAt:{$lte:before(grace,unit)},$or:[{purgeAt:{$lte:new Date(now)}},{purgeAt:{$exists:false}}]});return [
 {key:'email_tokens',model:User,filter:{'emailAction.hash':{$exists:true},'emailAction.expiresAt':{$lte:before(r.tokenHours,3600000)}},unset:{'emailAction.hash':1},reason:'expired_email_token_account_preserved'},
 {key:'reset_tokens',model:User,filter:{'passwordReset.hash':{$exists:true},'passwordReset.expiresAt':{$lte:before(r.tokenHours,3600000)}},unset:{'passwordReset.hash':1},reason:'expired_reset_token'},
 {key:'mfa_setup',model:Mfa,filter:{pendingSecret:{$exists:true},pendingUntil:{$lte:before(r.challengeMinutes,60000)}},unset:{pendingSecret:1,pendingUntil:1,pendingSession:1},reason:'expired_setup_active_factor_preserved'},
 {key:'mfa_challenges',model:Mfa,filter:{challengeHash:{$exists:true},challengeUntil:{$lte:before(r.challengeMinutes,60000)}},unset:{challengeHash:1,challengeUntil:1,challengeSession:1},reason:'expired_login_challenge'},
 {key:'limits',model:Limit,filter:expired(r.counterHours,3600000),reason:'expired_limit_window'},
 {key:'risk',model:Risk,filter:expired(r.counterHours,3600000),reason:'expired_risk_window'},
 {key:'captcha_deduplication',model:Captcha,filter:expired(r.captchaHours,3600000),reason:'expired_replay_window_plus_retention'},
 {key:'mail_jobs',model:Job,filter:{state:{$in:['accepted','failed','obsolete']},purgeAt:{$lte:new Date(now)},updatedAt:{$lte:before(r.mailDays,86400000)},$or:[{leaseUntil:{$lte:new Date(now)}},{leaseUntil:{$exists:false}}]},reason:'terminal_job_retention_elapsed'},
 {key:'mail_events',model:Event,filter:{purgeAt:{$lte:new Date(now)},createdAt:{$lte:before(r.eventDays,86400000)}},reason:'provider_event_deduplication_retention_elapsed'}
 ];}
async function simulate(cfg,now=Date.now()){const result={mode:'dry-run',accounts:{eligibleForDeletion:0,protected:await User.countDocuments(),reason:'account_deletion_not_implemented_all_roles_activity_assignments_and_pilot_accounts_preserved'},categories:{}};for(const p of plans(cfg,now))result.categories[p.key]={eligible:await p.model.countDocuments(p.filter),reason:p.reason};return result;}
async function run(cfg,{mode='dry-run',afterBatch}={}){
 if(!['dry-run','apply'].includes(mode))throw Error('INVALID_MAINTENANCE_MODE');if(mode==='apply'&&cfg.securityPolicy?.cleanupMode!=='apply')throw Error('MAINTENANCE_APPLY_DISABLED');
 const id=randomUUID(),now=new Date(),r=retention.settings(cfg);let lock;
 try{lock=await Lock.findOneAndUpdate({_id:'security',leaseUntil:{$lte:now}},{$set:{owner:id,leaseUntil:new Date(Date.now()+60000)}},{upsert:true,returnDocument:'after'});}catch(e){if(e.code===11000)return {state:'busy'};throw e;}
 try{
  await Run.updateMany({state:'running'},{$set:{state:'interrupted',reason:'previous_lease_expired',finishedAt:new Date()}});
  await Run.create({_id:id,mode,state:'running',startedAt:now,counts:{},purgeAt:retention.after(cfg,'auditDays')});
  if(mode==='dry-run'){const result=await simulate(cfg);await Run.updateOne({_id:id},{$set:{state:'completed',finishedAt:new Date(),counts:result}});return {id,state:'completed',...result};}
  let batches=0;const counts={};
  for(const p of plans(cfg,now.getTime())){
   counts[p.key]=0;
   while(batches<r.maxBatches){
    const renewed=await Lock.updateOne({_id:'security',owner:id,leaseUntil:{$gt:new Date()}},{$set:{leaseUntil:new Date(Date.now()+60000)}});if(!renewed.modifiedCount)throw Error('LEASE_LOST');
    const ids=(await p.model.find(p.filter).select('_id').limit(r.batchSize).lean()).map(x=>x._id);if(!ids.length)break;
    await Run.updateOne({_id:id,state:'running'},{$set:{batch:{category:p.key,candidates:ids.length,state:'started',reason:p.reason}}});
    if(!await Lock.exists({_id:'security',owner:id,leaseUntil:{$gt:new Date()}}))throw Error('LEASE_LOST');
    const filter={...p.filter,_id:{$in:ids}},result=p.unset?await p.model.updateMany(filter,{$unset:p.unset}):await p.model.deleteMany(filter),changed=p.unset?result.modifiedCount:result.deletedCount;
    if(afterBatch)await afterBatch(p.key);if(!await Lock.exists({_id:'security',owner:id,leaseUntil:{$gt:new Date()}}))throw Error('LEASE_LOST');counts[p.key]+=changed;batches++;
    await Run.updateOne({_id:id,state:'running'},{$set:{counts,batch:{category:p.key,candidates:ids.length,changed,state:'completed',reason:p.reason}}});
   }
   if(batches>=r.maxBatches)break;
  }
  await Run.updateOne({_id:id,state:'running'},{$set:{state:'completed',finishedAt:new Date(),counts}});return {id,state:'completed',mode,counts,batches,moreMayRemain:batches>=r.maxBatches,accountsDeleted:0};
 }catch{await Run.updateOne({_id:id,state:'running'},{$set:{state:'interrupted',finishedAt:new Date(),reason:'maintenance_interrupted_counts_may_be_partial'}});throw Error('MAINTENANCE_INTERRUPTED');}
 finally{await Lock.updateOne({_id:'security',owner:id},{$set:{leaseUntil:new Date(0)}});}
}
module.exports={plans,simulate,run};
