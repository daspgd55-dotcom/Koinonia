const {createHash}=require('node:crypto'),Used=require('../models/captcha-use.model'),{HttpError}=require('../utils/errors');
const actions=new Set(['register','login','forgot-password','reset-password','resend-verification','verify-email','accept-invitation']);
function configFromEnv(env){
 const siteKey=env.TURNSTILE_SITE_KEY,secret=env.TURNSTILE_SECRET_KEY,hostnames=(env.TURNSTILE_HOSTNAMES||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!siteKey&&!secret&&!hostnames.length)return null;
 if(!siteKey||!secret||!hostnames.length||hostnames.some(h=>!/^([a-z0-9-]+\.)*[a-z0-9-]+$/.test(h)))throw Error('Configuración Turnstile incompleta o inválida');
 if(env.NODE_ENV==='production'&&(/^[123]x0{10}/.test(siteKey)||/^[123]x0{10}/.test(secret)))throw Error('No usar claves Turnstile de prueba en producción');
 return {siteKey,secret,hostnames};
}
function validateConfig(config){if(config.securityPolicy.captchaMode==='enforce'&&(!config.captcha?.siteKey||!config.captcha?.secret||!config.captcha?.hostnames?.length||config.securityPolicy.advancedAbuseMode==='off'))throw Error('Configura Turnstile y observación de riesgo antes de exigir CAPTCHA');}
function turnstile(config){return {async verify(token){
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:config.secret,response:token}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('Provider unavailable');return response.json();
}};}
function middleware(config,adapter=config.captcha?turnstile(config.captcha):null){
 let lastLog=0;
 return async(req,res,next)=>{
  const action=req.path.slice(1),mode=config.securityPolicy.captchaMode;
  if(req.method!=='POST'||!actions.has(action)||mode==='off')return next();
  const risk=res.locals.abuseRisk,required=!risk||risk.action==='captcha'||risk.action==='unknown';
  if(mode==='observe'){
   if(required&&Date.now()-lastLog>60000){lastLog=Date.now();console.info(JSON.stringify({event:'captcha_observation',action,wouldChallenge:true,enforced:false}));}
   return next();
  }
  if(!required&&!req.get('X-Captcha-Token'))return next();
  const details={captcha:{provider:'turnstile',siteKey:config.captcha.siteKey,action}};
  const invalid=()=>new HttpError(403,'CAPTCHA_REQUIRED','Completa la comprobación de seguridad para continuar.',details);
  const token=req.get('X-Captcha-Token');
  if(!token||token.length>2048)return next(invalid());
  try{
   const result=await adapter.verify(token),timestamp=Date.parse(result.challenge_ts),age=Date.now()-timestamp;
   if(result.success!==true||!Number.isFinite(age)||age< -30000||age>300000||result.action!==action||!config.captcha.hostnames.includes(result.hostname))return next(invalid());
   try{await Used.create({_id:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+600000),purgeAt:require('../config/retention').after(config,'captchaHours',Date.now()+600000)});}catch(e){if(e.code===11000)return next(invalid());throw e;}
   return next();
  }catch{return next(new HttpError(503,'CAPTCHA_UNAVAILABLE','No pudimos comprobar la seguridad. Tus datos siguen aquí; intenta nuevamente.',details));}
 };
}
module.exports={configFromEnv,validateConfig,turnstile,middleware};
