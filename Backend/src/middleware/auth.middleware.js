const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { HttpError } = require('../utils/errors');

//Verifica que el usuario esté autenticado y que tenga un rol permitido

async function auth(req, res, next) {
  const match = /^Bearer ([^ ]+)$/.exec(req.headers.authorization || '');
  if (!match) throw new HttpError(401, 'UNAUTHORIZED', 'Se requiere Authorization: Bearer <token>');
  let claims;
  try { claims = jwt.verify(match[1], req.app.locals.config.jwtSecret, { algorithms: ['HS256'], issuer: 'koinonia', audience: 'koinonia-api' }); }
  catch { throw new HttpError(401, 'UNAUTHORIZED', 'Sesión inválida o expirada'); }
  if (typeof claims.sub !== 'string' || !/^[a-fA-F0-9]{24}$/.test(claims.sub)) throw new HttpError(401, 'UNAUTHORIZED', 'Sesión inválida');
  const user = await User.findById(claims.sub).select('+sessionVersion');
  if (!user?.active || (claims.sv || 0) !== (user.sessionVersion || 0)) throw new HttpError(401, 'UNAUTHORIZED', 'Sesión inválida');
  if(user.invitationPending||require('../services/account-security.service').required(user,req.app.locals.config))throw new HttpError(403,'EMAIL_VERIFICATION_REQUIRED','Verifica tu correo antes de continuar.');
  const enrolled=await require('../models/mfa.model').exists({user:user._id,active:true});
  if(enrolled&&!claims.mfa)throw new HttpError(401,'MFA_REQUIRED','Inicia sesión con tu segundo factor.');
  if(user.role==='admin'&&req.app.locals.config.securityPolicy?.adminMfaRequired&&!enrolled&&!(req.method==='GET'&&['/auth/mfa','/users/me'].includes(req.path)||req.method==='POST'&&['/auth/mfa/setup','/auth/mfa/confirm'].includes(req.path)))throw new HttpError(403,'MFA_ENROLLMENT_REQUIRED','Configura tu segundo factor desde Cuenta para continuar.');
  req.user = user; next();
}
const roles = (...allowed) => (req, res, next) => {
  if (!allowed.includes(req.user.role)) throw new HttpError(403, 'FORBIDDEN', 'Permisos insuficientes');
  next();
};
module.exports = { auth, roles };
