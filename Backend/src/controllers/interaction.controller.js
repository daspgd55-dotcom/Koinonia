const Interaction = require('../models/interaction.model');
const Church = require('../models/church.model');
const { visible, publicChurch } = require('../services/church.service');
const { HttpError } = require('../utils/errors');
const v = require('../validation/schemas');
exports.set = async (req, res) => {
  const data = v.parse(v.interaction, req.body);
  if (!await Church.exists({ _id: data.churchId, ...visible })) throw new HttpError(404, 'NOT_FOUND', 'Comunidad no encontrada');
  const filter = { user: req.user._id, church: data.churchId };
  const update = { $set: { type: data.type, ...(data.reason ? { reason: data.reason } : {}) }, ...(!data.reason ? { $unset: { reason: 1 } } : {}) };
  let item;
  try { item = await Interaction.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', runValidators: true }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    item = await Interaction.findOneAndUpdate(filter, update, { returnDocument: 'after', runValidators: true });
  }
  res.json({ data: item });
};
exports.list = async (req, res) => {
  const schema = v.z.strictObject({ churchId:v.id.optional(), type: v.z.enum(['saved', 'discarded']).optional(),
    page: v.z.coerce.number().int().min(1).max(10000).default(1), limit: v.z.coerce.number().int().min(1).max(100).default(20) });
  const { type, page, limit, churchId } = v.parse(schema, req.query);
  const filter = { user: req.user._id, ...(churchId?{church:churchId}:{}), ...(type ? { type } : {}) };
  const rows = await Interaction.find(filter).sort({ updatedAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).populate({ path: 'church', match: visible, transform: (doc,id)=>doc||{_id:id,unavailable:true} }).lean();
  res.json({ data: rows.map(row => ({ ...row, churchId: row.church._id, church: row.church.unavailable ? null : publicChurch(row.church) })),
    pagination: { page, limit, total: await Interaction.countDocuments(filter) } });
};
exports.remove = async (req, res) => {
  await Interaction.deleteOne({ user: req.user._id, church: v.parse(v.id, req.params.churchId) });
  res.status(204).end();
};
