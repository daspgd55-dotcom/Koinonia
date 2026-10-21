const {createHmac}=require('node:crypto'),{ipKeyGenerator}=require('express-rate-limit'),Counter=require('../models/abuse-counter.model');
const operations=new Set(['login','register','forgot-password','reset-password','resend-verification','verify-email','accept-invitation','change-password','mfa/login','mfa/setup','mfa/confirm','mfa/manage']);
const WINDOW=900000,SLOTS=2048,thresholds={account:30,source:120,operation:1000,global:3000};
let pending=0,lastFailureLog=0;
function sourceKey(ip){try{return ipKeyGenerator(require('ipaddr.js').process(ip).toString(),56);}catch{return 'unknown';}}
function identifier(value){return typeof value==='string'&&value.length<=320?value.trim().toLowerCase():'';}
function slot(secret,value){return createHmac('sha256',secret).update('abuse-v1:'+value).digest().readUInt32BE(0)%SLOTS;}
async function increment(id,now,store=Counter,cfg={}){
 if(pending>=256)throw Error('Observation capacity');pending++;
 const bucket=Math.floor(now/WINDOW),newer={$gt:['$bucket',bucket]},update=[{$set:{bucket:{$cond:[newer,'$bucket',bucket]},count:{$cond:[newer,'$count',{$cond:[{$eq:['$bucket',bucket]},{$min:[{$add:['$count',1]},1000000000]},1]}]},expiresAt:{$cond:[newer,'$expiresAt',new Date((bucket+2)*WINDOW)]},purgeAt:{$cond:[newer,'$purgeAt',require('../config/retention').after(cfg,'counterHours',(bucket+2)*WINDOW)]}}}];
 try{
  try{return await store.findOneAndUpdate({_id:id},update,{upsert:true,returnDocument:'after',updatePipeline:true,maxTimeMS:250}).lean();}
  catch(e){if(e.code!==11000)throw e;return await store.findOneAndUpdate({_id:id},update,{returnDocument:'after',updatePipeline:true,maxTimeMS:250}).lean();}
 }finally{pending--;}
}
function evaluate(counts){
 const reasons=Object.keys(thresholds).filter(k=>counts[k]>thresholds[k]);
 // Shared networks alone are a weak signal: suggest observation, not a challenge.
 return {action:reasons.some(k=>k!=='source')?'captcha':reasons.length?'monitor':'allow',reasons};
}
async function assess(config,input,{now=Date.now(),bump=increment,record=e=>console.info(JSON.stringify(e))}={}){
 if(config.securityPolicy.advancedAbuseMode!=='observe'||!operations.has(input.operation))return {action:'allow',reasons:[],observed:false};
 const op=input.operation,email=identifier(input.email),keys={global:'global',operation:op+':operation',source:op+':source:'+slot(config.jwtSecret,sourceKey(input.ip))};
 if(email)keys.account=op+':account:'+slot(config.jwtSecret,email);
 let timer;
 try{
  const rows=await Promise.race([Promise.all(Object.entries(keys).map(async([kind,id])=>[kind,(await bump(id,now,undefined,config)).count])),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('counter unavailable')),350);})]);
  const counts=Object.fromEntries(rows),decision=evaluate(counts);
  // At most one crossing per scope/slot/window across instances; no request data in logs.
  if(Object.keys(counts).some(k=>counts[k]===thresholds[k]+1))try{record({event:'abuse_observation',operation:op,action:decision.action,reasons:decision.reasons,enforced:false});}catch{}
  return {...decision,observed:true};
 }catch{
  if(Date.now()-lastFailureLog>60000){lastFailureLog=Date.now();try{record({event:'abuse_observation_unavailable',enforced:false});}catch{}}
  return {action:'unknown',reasons:['storage_unavailable'],observed:false};
 }finally{clearTimeout(timer);}
}
function middleware(config){return async(req,res,next)=>{
 if(req.method==='POST')res.locals.abuseRisk=await assess(config,{operation:req.path.replace(/^\//,''),ip:req.ip,email:req.body?.email});
 next();
};}
module.exports={assess,evaluate,increment,identifier,sourceKey,slot,middleware,WINDOW,SLOTS,operations,thresholds};
