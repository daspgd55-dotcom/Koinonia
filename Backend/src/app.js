const express = require('express'), cors = require('cors'), helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { HttpError, errorHandler } = require('./utils/errors');

// Crea y configura la aplicación Express con rutas, middleware y manejo de errores
function createApp(config) {
  const app = express(); app.locals.config = config; app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  const testUi = config.enableTestUi ?? process.env.NODE_ENV !== 'production';
  app.use(helmet(testUi ? { contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } } : {}), cors({ origin: config.corsOrigins }), express.json({ limit: '128kb' }));
  if (testUi) {
    app.get('/', (req, res) => res.redirect('/testing/'));
    app.use('/testing', express.static(require('node:path').resolve(__dirname, '../public/testing'), { etag: false, maxAge: 0 }));
  }
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', rateLimit({ windowMs: 900000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos' } } }));
  app.use('/api', require('./routes/api.routes'));
  app.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada')));
  app.use(errorHandler); return app;
}
module.exports = { createApp };
