const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const {boolean,loadSecurityPolicy}=require('./security-policy');
function loadConfig(env=process.env) {
  const { MONGO_URI, JWT_SECRET, RECOMMENDER_URL } = env;
  const securityPolicy=loadSecurityPolicy(env),emailRequired=boolean(env,'EMAIL_VERIFICATION_REQUIRED'),legacyRequired=boolean(env,'ENFORCE_LEGACY_EMAIL_VERIFICATION');
  if (!MONGO_URI) throw new Error('Falta MONGO_URI');
  if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('cambiar')) throw new Error('JWT_SECRET debe tener al menos 32 caracteres y ser propio');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido');
  if (RECOMMENDER_URL && !['http:', 'https:'].includes(new URL(RECOMMENDER_URL).protocol)) throw new Error('RECOMMENDER_URL inválida');
  const production = env.NODE_ENV === 'production';
  const corsOrigins = (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim());
  if (production && (!env.CORS_ORIGINS || corsOrigins.some(x => { try { const u = new URL(x); return u.protocol !== 'https:' || u.origin !== x; } catch { return true; } }))) throw new Error('Configura CORS_ORIGINS con los orígenes HTTPS del frontend');
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = env;
  if ([cloudName, apiKey, apiSecret].some(Boolean) && (![cloudName, apiKey, apiSecret].every(Boolean) || !/^[a-z0-9_-]+$/i.test(cloudName))) throw new Error('Configuración Cloudinary incompleta o inválida');
  const trustProxy = Number(env.TRUST_PROXY_HOPS || 0);
  let trustedProxies=null;
  if(env.TRUST_PROXY_CIDRS){
    if(trustProxy)throw Error('Usa TRUST_PROXY_CIDRS o TRUST_PROXY_HOPS, no ambos');
    try{trustedProxies=require('proxy-addr').compile(env.TRUST_PROXY_CIDRS.split(',').map(s=>s.trim()));}catch{throw Error('TRUST_PROXY_CIDRS inválido');}
  }
  const { RESEND_API_KEY, MAIL_FROM, APP_PUBLIC_URL } = env;
  let mail=null;
  if ([RESEND_API_KEY,MAIL_FROM,APP_PUBLIC_URL].some(Boolean)) {
    if (![RESEND_API_KEY,MAIL_FROM,APP_PUBLIC_URL].every(Boolean)) throw new Error('Configuración de correo incompleta');
    const u=new URL(APP_PUBLIC_URL);
    if (u.origin!==APP_PUBLIC_URL || (production ? u.protocol!=='https:' : !['http:','https:'].includes(u.protocol))) throw new Error('APP_PUBLIC_URL debe ser el origen del frontend sin barra final');
    mail={key:RESEND_API_KEY,from:MAIL_FROM,appUrl:APP_PUBLIC_URL};
  }
  if(emailRequired&&!mail)throw new Error('Configura correo antes de exigir verificacion de correo');
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) throw new Error('TRUST_PROXY_HOPS inválido');
  const mfa=require('../services/mfa.service').configFromEnv(env);
  if(securityPolicy.adminMfaRequired&&!mfa)throw Error('Configura las claves MFA antes de exigir segundo factor');
  const captcha=require('../services/captcha.service').configFromEnv(env);
  require('../services/captcha.service').validateConfig({captcha,securityPolicy});
  const mailQueue=require('../services/mail-queue.service').configFromEnv(env);
  require('../services/mail-queue.service').validate({mail,mailQueue,securityPolicy});
  const mailWebhookSecret=env.RESEND_WEBHOOK_SECRET||null,mailWebhookSource=env.MAIL_WEBHOOK_SOURCE||'provider';
  if(mailWebhookSecret){try{if(!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(mailWebhookSecret)||Buffer.from(mailWebhookSecret.slice(6),'base64').length<16)throw Error();new (require('svix').Webhook)(mailWebhookSecret);}catch{throw Error('RESEND_WEBHOOK_SECRET inválido');}}
  if(!['provider','simulated'].includes(mailWebhookSource)||(production&&mailWebhookSource==='simulated'))throw Error('MAIL_WEBHOOK_SOURCE inválido');
  return { outreachMail:require('./church-outreach-mail').load(env), retention:require('./retention').load(env), mailWebhookSecret, mailWebhookSource, mailQueue, captcha, mfa, mongoUri: MONGO_URI, jwtSecret: JWT_SECRET, port,
    enableTestUi: env.NODE_ENV !== 'production' && env.ENABLE_TEST_UI !== 'false',
    geocoding:env.GEOAPIFY_API_KEY?{apiKey:env.GEOAPIFY_API_KEY}:null,
    requireVerifiedEmail:true, verificationPaused:!emailRequired, enforceLegacyVerification:legacyRequired, securityPolicy,
    corsOrigins, trustProxy:trustedProxies||trustProxy, mail, cloudinary: cloudName ? { cloudName, apiKey, apiSecret } : null,
    recommenderUrl: RECOMMENDER_URL || null, recommenderToken: env.RECOMMENDER_TOKEN || '', recommenderTimeoutMs: 5000 };
}
module.exports = { loadConfig };
