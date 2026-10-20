const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
function loadConfig() {
  const { MONGO_URI, JWT_SECRET, RECOMMENDER_URL } = process.env;
  if (!MONGO_URI) throw new Error('Falta MONGO_URI');
  if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('cambiar')) throw new Error('JWT_SECRET debe tener al menos 32 caracteres y ser propio');
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido');
  if (RECOMMENDER_URL && !['http:', 'https:'].includes(new URL(RECOMMENDER_URL).protocol)) throw new Error('RECOMMENDER_URL inválida');
  const production = process.env.NODE_ENV === 'production';
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim());
  if (production && (!process.env.CORS_ORIGINS || corsOrigins.some(x => { try { const u = new URL(x); return u.protocol !== 'https:' || u.origin !== x; } catch { return true; } }))) throw new Error('Configura CORS_ORIGINS con los orígenes HTTPS del frontend');
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  if ([cloudName, apiKey, apiSecret].some(Boolean) && (![cloudName, apiKey, apiSecret].every(Boolean) || !/^[a-z0-9_-]+$/i.test(cloudName))) throw new Error('Configuración Cloudinary incompleta o inválida');
  const trustProxy = Number(process.env.TRUST_PROXY_HOPS || 0);
  const { RESEND_API_KEY, MAIL_FROM, APP_PUBLIC_URL } = process.env;
  let mail=null;
  if ([RESEND_API_KEY,MAIL_FROM,APP_PUBLIC_URL].some(Boolean)) {
    if (![RESEND_API_KEY,MAIL_FROM,APP_PUBLIC_URL].every(Boolean)) throw new Error('Configuración de correo incompleta');
    const u=new URL(APP_PUBLIC_URL);
    if (u.origin!==APP_PUBLIC_URL || (production ? u.protocol!=='https:' : !['http:','https:'].includes(u.protocol))) throw new Error('APP_PUBLIC_URL debe ser el origen del frontend sin barra final');
    mail={key:RESEND_API_KEY,from:MAIL_FROM,appUrl:APP_PUBLIC_URL};
  }
  if(process.env.EMAIL_VERIFICATION_REQUIRED==='true'&&process.env.ENFORCE_LEGACY_EMAIL_VERIFICATION==='true'&&!mail)throw new Error('Configura correo antes de exigir verificación a las cuentas existentes');
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) throw new Error('TRUST_PROXY_HOPS inválido');
  return { mongoUri: MONGO_URI, jwtSecret: JWT_SECRET, port,
    enableTestUi: process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_UI !== 'false',
    geocoding:process.env.GEOAPIFY_API_KEY?{apiKey:process.env.GEOAPIFY_API_KEY}:null,
    requireVerifiedEmail:true, verificationPaused:process.env.EMAIL_VERIFICATION_REQUIRED!=='true', enforceLegacyVerification:process.env.ENFORCE_LEGACY_EMAIL_VERIFICATION==='true',
    corsOrigins, trustProxy, mail, cloudinary: cloudName ? { cloudName, apiKey, apiSecret } : null,
    recommenderUrl: RECOMMENDER_URL || null, recommenderToken: process.env.RECOMMENDER_TOKEN || '', recommenderTimeoutMs: 5000 };
}
module.exports = { loadConfig };
