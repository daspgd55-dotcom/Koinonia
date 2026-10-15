const { Types } = require('mongoose');
const Community = require('../models/linked-community.model'), Church = require('../models/church.model');
const v = require('../validation/linked-community'), { id, parse } = require('../validation/schemas');
const { managed, visible, publicChurch } = require('../services/church.service');
const { HttpError } = require('../utils/errors');
const { expectedVersion } = require('../utils/resource-version');
const notFound = () => new HttpError(404, 'NOT_FOUND', 'Comunidad vinculada no encontrada');
const objectId = value => new Types.ObjectId(parse(id, value));
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reply = (res, data, status = 200) => res.status(status).set('Cache-Control', 'no-store').set('ETag', '"' + data.version + '"').json({ data });
const parent = (req, churchId) => managed({ user: req.user, params: { id: String(churchId) } }, { includeInactive: true });
async function managedCommunity(req) {
  const data = await Community.findById(objectId(req.params.id));
  if (!data) throw notFound();
  const church = await parent(req, data.churchId); return { data, church };
}
function publicData(data, church) {
  const contact = { ...data.contact };
  for (const key of ['email', 'phone']) if (data.privateFields?.[key]) delete contact[key];
  const location = data.location.mode === 'church' ? { mode: 'church', resolved: publicChurch(church).location } : data.location;
  return { _id: data._id, churchId: data.churchId, church: { _id: church._id, name: church.identification.name }, name: data.name, type: data.type, description: data.description, audience: data.audience, leaders: data.leaders, contact, location, media: data.media };
}
function assertPublishable(church) {
  if (!church.active || !['published', 'verified'].includes(church.metadata?.dataStatus) || !church.metadata?.firstPublishedByAdminAt)
    throw new HttpError(409, 'CHURCH_NOT_PUBLISHABLE', 'La iglesia debe estar publicada y contar con una primera publicación autorizada por un administrador');
}
exports.create = async (req, res) => {
  const body = parse(v.create, req.body); await parent(req, body.churchId);
  const data = await Community.create({ ...body, createdBy: req.user._id, updatedBy: req.user._id }); reply(res, data, 201);
};
exports.detail = async (req, res) => { const { data } = await managedCommunity(req); reply(res, data); };
async function mutate(req, res, isStatus) {
  const body = parse(isStatus ? v.status : v.patch, req.body), version = expectedVersion(req);
  const { data, church } = await managedCommunity(req);
  if (isStatus && body.status === 'published') assertPublishable(church);
  const updated = await Community.findOneAndUpdate({ _id: data._id, version }, { $set: { ...body, updatedBy: req.user._id }, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new HttpError(409, 'STALE_VERSION', 'La comunidad cambió en otra sesión. Recarga antes de guardar.');
  reply(res, updated);
}
exports.update = (req, res) => mutate(req, res, false);
exports.status = (req, res) => mutate(req, res, true);
exports.get = async (req, res) => {
  const data = await Community.findOne({ _id: objectId(req.params.id), status: 'published' }).lean();
  if (!data) throw notFound();
  const church = await Church.findOne({ _id: data.churchId, ...visible }).lean();
  if (!church) throw notFound();
  res.set('Cache-Control', 'no-store').json({ data: publicData(data, church) });
};
async function list(req, res, management) {
  const q = parse(management ? v.managedQuery : v.query, req.query), filter = {};
  if (q.churchId) { filter.churchId = objectId(q.churchId); if (management) await parent(req, q.churchId); }
  if (!management) filter.status = 'published'; else if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.q) filter.name = new RegExp(escape(q.q), 'i');
  const scope = management ? (req.user.role === 'admin' ? {} : { 'parent.representatives': req.user._id }) : Object.fromEntries(Object.entries(visible).map(([key, value]) => ['parent.' + key, value]));
  const [result] = await Community.aggregate([{ $match: filter }, { $lookup: { from: Church.collection.name, localField: 'churchId', foreignField: '_id', as: 'parent' } }, { $unwind: '$parent' }, { $match: scope },
    { $sort: { name: 1, _id: 1 } }, { $facet: { rows: [{ $skip: (q.page - 1) * q.limit }, { $limit: q.limit }], total: [{ $count: 'value' }] } }]);
  const total = result.total[0]?.value || 0, data = result.rows.map(({ parent: church, ...row }) => management ? row : publicData(row, church));
  res.set('Cache-Control', 'no-store').json({ data, pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } });
}
exports.list = (req, res) => list(req, res, false);
exports.manage = (req, res) => list(req, res, true);
exports.managedCommunity = managedCommunity;
exports.expectedVersion = expectedVersion;
