const express = require('express'), cors = require('cors'), helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { HttpError, errorHandler } = require('./utils/errors');

// Crea y configura la aplicación Express con rutas, middleware y manejo de errores
function createApp(config) {
  const policy=require('./config/security-policy').validatePolicy(config.securityPolicy);
  if(Object.getOwnPropertyDescriptor(config,'securityPolicy')?.configurable!==false)Object.defineProperty(config,'securityPolicy',{value:policy,enumerable:true,writable:false,configurable:false});
  if(policy.adminMfaRequired&&!config.mfa)throw Error('Configura las claves MFA antes de exigir segundo factor');
  require('./services/captcha.service').validateConfig(config);
  require('./services/mail-queue.service').validate(config);
  const app = express(); app.locals.config = config; app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  const testUi = config.enableTestUi ?? process.env.NODE_ENV !== 'production';
  app.use(helmet(testUi ? { contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } } : {}), cors({ origin: config.corsOrigins }));
  app.post('/api/webhooks/resend',express.raw({type:'application/json',limit:'128kb',inflate:false}),require('./services/mail-observability.service').webhook);
  app.use(express.json({limit:'128kb'}));
  if (testUi) {
    app.get('/', (req, res) => res.redirect('/testing/'));
    app.use('/testing', express.static(require('node:path').resolve(__dirname, '../public/testing'), { etag: false, maxAge: 0 }));
  }
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth',require('./services/abuse-risk.service').middleware(config));
  app.use('/api/auth',async(req,res,next)=>{const security=require('./services/account-security.service');res.set('Cache-Control','no-store');if(security.enabled(config))await security.quota(config,'auth-ip',req.ip,60,900000);next();});
  app.use('/api/auth', rateLimit({ windowMs: 900000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos' } } }));
  app.use('/api/auth',require('./services/captcha.service').middleware(config));
  app.use('/api', require('./routes/api.routes'));
  app.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada')));
  app.use(errorHandler); return app;
}
module.exports = { createApp };
