const Church = require('../models/church.model');
const { HttpError } = require('../utils/errors');
const { id, parse } = require('../validation/schemas');
const visible = { active: true, 'metadata.dataStatus': { $in: ['published', 'verified'] } };
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = value => new RegExp('^' + escape(value) + '$', 'i');

// Función para devolver la información pública de una iglesia, sin datos sensibles ni internos
function publicChurch(doc) {
  const c = doc.toObject ? doc.toObject() : { ...doc };
  delete c.representatives; delete c.createdBy; delete c.updatedBy; delete c.__v; delete c.importInfo; delete c.reviewImport;
  c.verification = { lastUpdated: c.verification?.lastUpdated };
  const hidden = c.privateFields || {};
  c.doctrine = { ...c.doctrine }; c.contact = { ...c.contact };
  for (const field of ['soteriology', 'eschatology']) if (hidden[field]) delete c.doctrine[field];
  for (const field of ['email', 'phone']) if (hidden[field]) delete c.contact[field];
  if (c.externalProfile) {
    c.externalProfile = { ...c.externalProfile };
    if (hidden.email) delete c.externalProfile.emails;
    if (hidden.phone) delete c.externalProfile.phones;
    if (hidden.email || hidden.phone) c.externalProfile.links = (c.externalProfile.links || []).filter(x => !(hidden.email && /^mailto:/i.test(x.url)) && !(hidden.phone && /^tel:/i.test(x.url)));
  }
  if(hidden.accessibilityLevel){c.location={...c.location};delete c.location.accessibility;delete c.location.accessibilityLevel;delete c.location.accessNotes;}
  delete c.privateFields;
  return c;
}

//Función para obtener una iglesia y verificar que el usuario tenga permisos de administración
async function managed(req, { includeInactive = false } = {}) {
  const church = await Church.findOne({ _id: parse(id, req.params.id), ...(!includeInactive ? { active: true } : {}) });
  if (!church) throw new HttpError(404, 'NOT_FOUND', 'Comunidad no encontrada');
  if (req.user.role !== 'admin' && !(req.user.role === 'representative' && church.representatives.some(x => x.equals(req.user._id))))
    throw new HttpError(403, 'FORBIDDEN', 'No puedes administrar esta comunidad');
  return church;
}

//funcion para verificar la version de la ficha de iglesia antes de actualizarla
function checkVersion(req, church) {
  const value = req.get('If-Match');
  if (value === undefined) return;
  const match = /^"(\d+)"$/.exec(value);
  if (!match) throw new HttpError(400, 'INVALID_VERSION', 'If-Match debe contener la versión entre comillas');
  if (Number(match[1]) !== church.metadata.version) throw new HttpError(409, 'STALE_VERSION', 'La ficha cambió en otra sesión. Recarga antes de guardar.');
}

//funcion para filtrar iglesias según parámetros de búsqueda
function filters(q) {
  const filter = { ...visible };
  const fields = { commune: 'location.commune', denomination: 'christianIdentity.denomination', branch: 'christianIdentity.branch',
    doctrine: 'doctrine.characteristics', activity: 'community.activities', language: 'christianIdentity.languages', day: 'meetings.schedule.day' };
  for (const [key, path] of Object.entries(fields)) if (q[key]) filter[path] = exact(q[key]);
  if (q.q) filter['identification.name'] = new RegExp(escape(q.q), 'i');
  return filter;
}

//funcion para buscar iglesias según parámetros de búsqueda, con paginación y ordenamiento por distancia si se proveen coordenadas
async function search(q, excluded = [], cap) {
  const filter = filters(q);
  if (excluded.length) filter._id = { $nin: excluded };
  const limit = cap || q.limit || 20, page = q.page || 1;
  let rows, total;
  if (q.lat !== undefined && q.lng !== undefined) {
    const result = await Church.aggregate([
      { $geoNear: { near: { type: 'Point', coordinates: [q.lng, q.lat] }, key: 'location.coordinates', distanceField: 'distanceMeters',
        maxDistance: (q.radius || 5) * 1000, spherical: true, query: filter } },
      { $sort: { distanceMeters: 1, _id: 1 } },
      { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'value' }] } }
    ]);
    rows = result[0].rows; total = result[0].total[0]?.value || 0;
  } else {
    [rows, total] = await Promise.all([Church.find(filter).sort({ 'identification.name': 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), Church.countDocuments(filter)]);
  }
  return { data: rows.map(publicChurch), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { visible, publicChurch, managed, filters, search, exact, checkVersion };
