const security=require('../services/account-security.service');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const v = require('../validation/schemas');
const { HttpError } = require('../utils/errors');
const publicUser = user => ({ id: user.id, emailVerified:!!user.emailVerifiedAt, emailVerificationRequired:!!user.emailVerificationRequired, email: user.email, name: user.name, avatarUrl: user.avatar?.url || null, avatarVersion: user.avatarVersion || 0, username: user.username, role: user.role, membershipChurch: user.membershipChurch || null, preferences: user.preferences,
  searchContext: user.searchContext || {}, criterionModes: user.criterionModes || {}, answerStates: user.answerStates || {},
  onboarding: user.onboarding, profileRevision: user.profileRevision || 0 });
exports.register = async (req, res) => {
  const data = v.parse(v.register, req.body);
  if(security.enabled(req.app.locals.config)){
    const config=req.app.locals.config;security.mailReady(config);
    await security.quota(config,'registration-ip',req.ip,10,3600000);await security.quota(config,'mail-email',data.email,5,3600000);
    const password=await bcrypt.hash(data.password,12);let pending;
    try{pending=await User.create({...data,password,role:'user',emailVerificationRequired:true});}catch(e){if(e.code!==11000)throw e;}
    if(pending)await security.issue(req,pending,'verify');
    return res.status(202).json({verificationRequired:true,message:security.message});
  }
  const user = await User.create({ ...data, password: await bcrypt.hash(data.password, 12), role: 'user' });
  res.status(201).json({ data: publicUser(user) });
};
exports.login = async (req, res) => {
  const data = v.parse(v.login, req.body);
  if(security.enabled(req.app.locals.config))await security.quota(req.app.locals.config,'login-email',data.email,20,900000);
  const user = await User.findOne({ email: data.email }).select('+password +sessionVersion');
  // Evita que una cuenta inexistente tome una ruta sin el coste de bcrypt.
  const hash = user?.password || '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
  const valid = await bcrypt.compare(data.password, hash);
  if (!user?.active || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
  if(user.invitationPending||security.required(user,req.app.locals.config))throw new HttpError(403,'EMAIL_VERIFICATION_REQUIRED','Verifica tu correo para continuar. Puedes solicitar un nuevo enlace.');
  const token = jwt.sign({ sv: user.sessionVersion || 0 }, req.app.locals.config.jwtSecret, { algorithm: 'HS256', subject: user.id, expiresIn: '1h', issuer: 'koinonia', audience: 'koinonia-api' });
  res.json({ token, tokenType: 'Bearer', expiresIn: 3600, data: publicUser(user) });
};
exports.publicUser = publicUser;
