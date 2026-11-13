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
const parent = (req, churchId) => managed({ user: req.user, params: { id: String(churchId) } }, { includeInactive: true, permission: 'content' });
async function managedCommunity(req) {
  const data = await Community.findById(objectId(req.params.id));
  if (!data) throw notFound();
  const church = await parent(req, data.churchId); return { data, church };
}
function publicData(data, church) {
  const contact = { ...data.contact };
  for (const key of ['email', 'phone']) if (data.privateFields?.[key]) delete contact[key];
  const location = data.location.mode === 'church' ? { mode: 'church', resolved: publicChurch(church).location } : data.location;
  return { _id: data._id, churchId: data.churchId, church: { _id: church._id, name: church.identification.name }, name: data.name, type: data.type, description: data.description, audience: data.audience, leaders: data.leaders, contact, location, schedules:{mode:data.schedules?.mode||'none',meetings:(data.schedules?.mode==='church'?(church.meetings||[]).filter(m=>data.schedules.meetingIds===undefined||data.schedules.meetingIds.includes(m.id)):data.schedules?.mode==='custom'?data.schedules.meetings:[])?.map(m=>({type:m.type,audience:m.audience,modality:m.modality,addressOrUrl:m.addressOrUrl,frequency:m.frequency,frequencyNotes:m.frequencyNotes,schedule:m.schedule}))||[]}, media: data.media };
}
function assertPublishable(church) {
  if (!church.active || !['published', 'verified'].includes(church.metadata?.dataStatus) || !church.metadata?.firstPublishedByAdminAt)
    throw new HttpError(409, 'CHURCH_NOT_PUBLISHABLE', 'La iglesia debe estar publicada y contar con una primera publicación autorizada por un administrador');
}
exports.create = async (req, res) => {
  const body = parse(v.create, req.body),church=await parent(req, body.churchId);validateSchedules(body,church);
  const data = await Community.create({ ...body, createdBy: req.user._id, updatedBy: req.user._id }); reply(res, data, 201);
};
exports.detail = async (req, res) => { const { data } = await managedCommunity(req); reply(res, data); };
async function mutate(req, res, isStatus) {
  const body = parse(isStatus ? v.status : v.patch, req.body), version = expectedVersion(req);
  const { data, church } = await managedCommunity(req);
  if(!isStatus)validateSchedules(body,church);
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
  if(!management&&!q.churchId)filter.churchId={$ne:require('../services/church.service').showcaseId};
  if (!management) filter.status = 'published'; else if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.q) filter.name = new RegExp(escape(q.q), 'i');
  const scope = management ? (req.user.role === 'admin' ? {} : require('../services/church-permissions').scope(req.user,'content','parent.')) : Object.fromEntries(Object.entries(visible).map(([key, value]) => ['parent.' + key, value]));
  const [result] = await Community.aggregate([{ $match: filter }, { $lookup: { from: Church.collection.name, localField: 'churchId', foreignField: '_id', as: 'parent' } }, { $unwind: '$parent' }, { $match: scope },
    { $addFields: { displayOrder: { $ifNull: ['$displayOrder', 1000] } } }, { $sort: q.churchId ? { displayOrder: 1, name: 1, _id: 1 } : { name: 1, _id: 1 } }, { $facet: { rows: [{ $skip: (q.page - 1) * q.limit }, { $limit: q.limit }], total: [{ $count: 'value' }] } }]);
  const total = result.total[0]?.value || 0, data = result.rows.map(({ parent: church, ...row }) => management ? { ...row, church: { _id: church._id, name: church.identification.name } } : publicData(row, church));
  res.set('Cache-Control', 'no-store').json({ data, pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } });
}
exports.list = (req, res) => list(req, res, false);
exports.manage = (req, res) => list(req, res, true);
exports.managedCommunity = managedCommunity;
exports.expectedVersion = expectedVersion;

function validateSchedules(body,church){const ids=body.schedules?.meetingIds;if(ids&&ids.some(id=>!church.meetings.some(m=>m.id===id)))throw new HttpError(400,'INVALID_MEETING','Alguna reunión ya no pertenece a la iglesia. Revisa los horarios seleccionados.');}

exports.remove=async(req,res)=>{
 const version=expectedVersion(req),{data}=await managedCommunity(req);
 await Community.db.transaction(async session=>{
  if(await require('../models/event.model').exists({communityId:data._id}).session(session))throw new HttpError(409,'COMMUNITY_HAS_EVENTS','Esta comunidad tiene eventos asociados. Edita esos eventos para quitar o cambiar su comunidad organizadora antes de eliminarla.');
  const deleted=await Community.findOneAndDelete({_id:data._id,version}).session(session);
  if(!deleted)throw new HttpError(409,'STALE_VERSION','La comunidad cambió en otra sesión. Recarga antes de eliminar.');
 });
 res.set('Cache-Control','no-store').json({message:'Comunidad eliminada definitivamente.'});
};

exports.move=async(req,res)=>{
 const {direction}=parse(require('../validation/schemas').z.strictObject({direction:require('../validation/schemas').z.enum(['up','down'])}),req.body),version=expectedVersion(req),{data}=await managedCommunity(req);
 const position=await Community.db.transaction(async session=>{
  const rows=await Community.find({churchId:data.churchId}).session(session).lean();rows.sort((a,b)=>(a.displayOrder??1000)-(b.displayOrder??1000)||(a.name<b.name?-1:a.name>b.name?1:0)||String(a._id).localeCompare(String(b._id)));
  const index=rows.findIndex(c=>String(c._id)===String(data._id));if(index<0||rows[index].version!==version)throw new HttpError(409,'STALE_VERSION','La comunidad cambió. Recarga la lista antes de ordenar.');
  const next=index+(direction==='up'?-1:1);if(next<0||next>=rows.length)return index;
  if(rows.length>10000)throw new HttpError(409,'ORDER_LIMIT','El listado excede el límite de ordenación.');
  [rows[index],rows[next]]=[rows[next],rows[index]];
  for(let i=0;i<rows.length;i++){const result=await Community.updateOne({_id:rows[i]._id,version:rows[i].version},{$set:{displayOrder:i,updatedBy:req.user._id},$inc:{version:1}},{session});if(result.modifiedCount!==1)throw new HttpError(409,'STALE_VERSION','La lista cambió en otra sesión. Recarga antes de ordenar.');}
  return next;
 });res.set('Cache-Control','no-store').json({position,message:'Orden actualizado.'});
};
