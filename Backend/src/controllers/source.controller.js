const Source = require('../models/source.model');
const Church = require('../models/church.model');
const { managed, visible } = require('../services/church.service');
const { HttpError } = require('../utils/errors');
const v = require('../validation/schemas');
exports.list = async (req, res) => {
  const churchId = v.parse(v.id, req.params.id);
  if (!await Church.exists({ _id: churchId, ...visible })) throw new HttpError(404, 'NOT_FOUND', 'Comunidad no encontrada');
  const { page, limit } = v.parse(v.search, req.query);
  const filter = { church: churchId, status: 'approved' };
  const data = await Source.find(filter).select('-createdBy -__v').sort({ _id: 1 }).skip((page - 1) * limit).limit(limit);
  res.json({ data, pagination: { page, limit, total: await Source.countDocuments(filter) } });
};
exports.create = async (req, res) => {
  const church = await managed(req);
  const data = v.parse(v.source, req.body);
  const source = await Source.create({ ...data, church: church._id, createdBy: req.user._id });
  res.status(201).json({ data: source });
};
exports.pending = async (req, res) => {
  const { page, limit } = v.parse(v.search, req.query);
  res.json({ data: await Source.find({ status: 'pending' }).sort({ _id: 1 }).skip((page - 1) * limit).limit(limit) });
};
exports.status = async (req, res) => {
  const sourceId = v.parse(v.id, req.params.sourceId);
  const { status } = v.parse(v.z.strictObject({ status: v.z.enum(['pending', 'approved']) }), req.body);
  const source = await Source.findByIdAndUpdate(sourceId, { $set: { status } }, { returnDocument: 'after', runValidators: true });
  if (!source) throw new HttpError(404, 'NOT_FOUND', 'Fuente no encontrada');
  res.json({ data: source });
};
