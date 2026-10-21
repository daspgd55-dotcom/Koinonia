const crypto=require('node:crypto'),OTPAuth=require('otpauth'),{HttpError}=require('../utils/errors'),Mfa=require('../models/mfa.model'),security=require('./account-security.service');
function configFromEnv(env){
 if(!env.MFA_ENCRYPTION_KEYS&&!env.MFA_ACTIVE_KEY_ID)return null;
 let keys;try{keys=JSON.parse(env.MFA_ENCRYPTION_KEYS);}catch{throw Error('MFA_ENCRYPTION_KEYS debe contener un objeto JSON de claves');}
 if(!keys||Array.isArray(keys)||typeof keys!=='object'||!Object.keys(keys).length||!Object.hasOwn(keys,env.MFA_ACTIVE_KEY_ID))throw Error('Configura las claves MFA y MFA_ACTIVE_KEY_ID');
 for(const [id,key] of Object.entries(keys))if(!/^[a-zA-Z0-9_-]{1,40}$/.test(id)||typeof key!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32)throw Error('Cada clave MFA debe ser de 32 bytes en base64 con identificador válido');
 return {keys,activeKeyId:env.MFA_ACTIVE_KEY_ID};
}
function ready(cfg){if(!cfg.mfa)throw new HttpError(503,'MFA_UNAVAILABLE','El segundo factor no está configurado en el servidor.');return cfg.mfa;}
function seal(secret,user,cfg){const c=ready(cfg),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(c.keys[c.activeKeyId],'base64'),iv);cipher.setAAD(Buffer.from(String(user)));const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return [c.activeKeyId,iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');}
function unseal(value,user,cfg){const c=ready(cfg);try{const [id,iv,tag,data]=value.split('.');const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(c.keys[id],'base64'),Buffer.from(iv,'base64'));decipher.setAAD(Buffer.from(String(user)));decipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8');}catch{throw new HttpError(503,'MFA_KEY_UNAVAILABLE','No se puede acceder al segundo factor. Contacta con soporte.');}}
const totp=(secret,label)=>new OTPAuth.TOTP({issuer:'Koinonía',label,algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)});
function step(secret,code){if(!/^\d{6}$/.test(code))return null;const now=Date.now(),delta=totp(secret).validate({token:code,timestamp:now,window:1});return delta===null?null:Math.floor(now/30000)+delta;}
const recovery=()=>Array.from({length:10},()=>crypto.randomBytes(16).toString('hex'));
const audit=(action,user)=>({history:{$each:[{action,at:new Date(),actor:user}],$slice:-100}});
const invalid=()=>new HttpError(401,'MFA_INVALID','Código o desafío inválido, utilizado o vencido.');
async function challenge(user,cfg){
 ready(cfg);const value=crypto.randomBytes(32).toString('hex');
 const changed=await Mfa.updateOne({user:user._id,active:true},{$set:{challengeHash:security.hash(value),challengeUntil:new Date(Date.now()+300000),challengeSession:user.sessionVersion||0}});
 if(!changed.matchedCount)throw invalid();return {mfaRequired:true,challenge:value,expiresIn:300};
}
async function proof(row,code,cfg){
 if(/^\d{6}$/.test(code)){const counter=step(unseal(row.secret,row.user,cfg),code);if(counter===null||counter<=row.lastStep)throw invalid();return {filter:{lastStep:{$lt:counter}},update:{$set:{lastStep:counter}}};}
 if(!/^[a-f0-9]{32}$/.test(code))throw invalid();const digest=security.hash(code);if(!row.recoveryHashes.includes(digest))throw invalid();return {filter:{recoveryHashes:digest},update:{$pull:{recoveryHashes:digest}}};
}
module.exports={configFromEnv,ready,seal,unseal,totp,step,recovery,audit,invalid,challenge,proof};
