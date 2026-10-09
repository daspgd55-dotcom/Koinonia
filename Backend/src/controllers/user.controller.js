const User = require('../models/user.model');
const { publicUser } = require('./auth.controller');
const { HttpError } = require('../utils/errors');
const v = require('../validation/schemas');
exports.profile = (req, res) => res.json({ data: publicUser(req.user) });
exports.preferences = async (req, res) => {
  const updated = await require('../services/profile.service').updateProfile(req.user, { preferences: v.parse(v.preferences, req.body) }, { replacePreferences: true });
  res.json({ data: publicUser(updated) });
};
exports.updateProfile = async (req, res) => {
  const updated = await require('../services/profile.service').updateProfile(req.user, v.parse(v.profilePatch, req.body));
  res.json({ data: publicUser(updated) });
};
exports.role = async (req, res) => {
  const id = v.parse(v.id, req.params.id);
  const { role } = v.parse(v.z.strictObject({ role: v.z.enum(['user', 'representative', 'admin']) }), req.body);
  if (id === req.user.id) throw new HttpError(409, 'SELF_ROLE_CHANGE', 'No puedes cambiar tu propio rol');
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'Usuario no encontrado');
  user.role = role; await user.save(); res.json({ data: { id: user.id, role: user.role } });
};

exports.lookup = async (req, res) => {
  const { email } = v.parse(v.z.strictObject({ email: v.z.string().trim().email().max(254).toLowerCase() }), req.query);
  const data = await User.findOne({ email }).select('_id name email role active').lean();
  res.set('Cache-Control', 'no-store').json({ data });
};
exports.promoteRepresentative = async (req, res) => {
  const id = v.parse(v.id, req.params.id);
  v.parse(v.z.strictObject({}), req.body || {});
  const data = await User.findOneAndUpdate({ _id: id, role: 'user', active: true }, { $set: { role: 'representative' } }, { returnDocument: 'after' }).select('_id name email role active').lean();
  if (!data) throw new HttpError(409, 'ROLE_CHANGED', 'La cuenta debe estar activa y tener rol de usuario. Consulta nuevamente su estado.');
  res.json({ data });
};

const adminProjection = '_id name email position role active createdAt updatedAt';
exports.listManaged = async (req, res) => {
  const q = v.parse(v.z.strictObject({ q: v.z.string().trim().max(200).optional(), role: v.z.enum(['user','representative','admin']).optional(), active: v.z.enum(['all','active','inactive']).default('all'), page: v.z.coerce.number().int().min(1).max(10000).default(1), limit: v.z.coerce.number().int().min(1).max(100).default(12) }), req.query);
  const filter = {};
  if (q.role) filter.role = q.role;
  if (q.active !== 'all') filter.active = q.active === 'active';
  if (q.q) { const literal = q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = ['name','email'].map(k => ({ [k]: new RegExp(literal,'i') })); }
  const [data,total] = await Promise.all([User.find(filter).select(adminProjection).sort({email:1,_id:1}).skip((q.page-1)*q.limit).limit(q.limit).lean(), User.countDocuments(filter)]);
  res.set('Cache-Control','no-store').json({data,pagination:{page:q.page,limit:q.limit,total,pages:Math.ceil(total/q.limit)}});
};
exports.updateManaged = async (req, res) => {
  const id = v.parse(v.id,req.params.id), data = v.parse(v.z.strictObject({ name:v.z.string().trim().max(100), position:v.z.string().trim().max(200), role:v.z.enum(['user','representative','admin']), active:v.z.boolean(), expectedUpdatedAt:v.z.string().datetime() }),req.body);
  if (id === req.user.id && (data.role !== req.user.role || !data.active)) throw new HttpError(409,'SELF_ACCESS_CHANGE','No puedes cambiar tu propio rol ni desactivar tu cuenta.');
  const {expectedUpdatedAt,...changes} = data;
  const updated = await User.findOneAndUpdate({_id:id,updatedAt:new Date(expectedUpdatedAt)},{$set:changes},{returnDocument:'after',runValidators:true}).select(adminProjection).lean();
  if (!updated) throw new HttpError(409,'STALE_USER','La cuenta cambió o ya no está disponible. Recarga la lista antes de editar.');
  res.set('Cache-Control','no-store').json({data:updated});
};
