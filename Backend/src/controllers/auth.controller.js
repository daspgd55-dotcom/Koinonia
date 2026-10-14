const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const v = require('../validation/schemas');
const { HttpError } = require('../utils/errors');
const publicUser = user => ({ id: user.id, email: user.email, name: user.name, role: user.role, membershipChurch: user.membershipChurch || null, preferences: user.preferences,
  searchContext: user.searchContext || {}, criterionModes: user.criterionModes || {}, answerStates: user.answerStates || {},
  onboarding: user.onboarding, profileRevision: user.profileRevision || 0 });
exports.register = async (req, res) => {
  const data = v.parse(v.register, req.body);
  const user = await User.create({ ...data, password: await bcrypt.hash(data.password, 12), role: 'user' });
  res.status(201).json({ data: publicUser(user) });
};
exports.login = async (req, res) => {
  const data = v.parse(v.login, req.body);
  const user = await User.findOne({ email: data.email }).select('+password +sessionVersion');
  // Evita que una cuenta inexistente tome una ruta sin el coste de bcrypt.
  const hash = user?.password || '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
  const valid = await bcrypt.compare(data.password, hash);
  if (!user?.active || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
  const token = jwt.sign({ sv: user.sessionVersion || 0 }, req.app.locals.config.jwtSecret, { algorithm: 'HS256', subject: user.id, expiresIn: '1h', issuer: 'koinonia', audience: 'koinonia-api' });
  res.json({ token, tokenType: 'Bearer', expiresIn: 3600, data: publicUser(user) });
};
exports.publicUser = publicUser;
