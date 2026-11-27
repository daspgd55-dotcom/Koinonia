const Church = require('../models/church.model');
const { HttpError } = require('../utils/errors');
const { id, parse } = require('../validation/schemas');
const visible = { active: true, 'metadata.dataStatus': { $in: ['published', 'verified'] } };
// Ficha editorial de ejemplo: accesible por URL, excluida del descubrimiento.
const showcaseBatch='showcase-senderos-2026-11-05',showcaseId=new (require('mongoose').Types.ObjectId)(require('node:crypto').createHash('sha256').update(showcaseBatch+'church').digest('hex').slice(0,24));
const discoveryExclusions={$nor:[{_id:showcaseId},{'importInfo.batchId':showcaseBatch}]};
const discoverable={...visible,...discoveryExclusions};
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = value => new RegExp('^' + escape(value) + '$', 'i');

// Función para devolver la información pública de una iglesia, sin datos sensibles ni internos
function publicChurch(doc) {
  const c = doc.toObject ? doc.toObject() : { ...doc };
  delete c.registrationSources; delete c.representativeRoles; delete c.teamAudit; delete c.visitSettings; delete c.publicationRequest; delete c.representatives; delete c.createdBy; delete c.updatedBy; delete c.__v; delete c.importInfo; delete c.reviewImport;
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
  c.community={...c.community};
  for(const field of ['musicalStyles','culturalStyle'])if(hidden[field])delete c.community[field];
  if(hidden.accessibilityDetails??hidden.accessibilityLevel){c.location={...c.location};delete c.location.accessibilityDetails;}
  delete c.privateFields;
  return c;
}

//Función para obtener una iglesia y verificar que el usuario tenga permisos de administración
async function managed(req, { includeInactive = false, permission = 'church', session = null } = {}) {
  const church = await Church.findOne({ _id: parse(id, req.params.id), ...(!includeInactive ? { active: true } : {}) }).session(session);
  if (!church) throw new HttpError(404, 'NOT_FOUND', 'Comunidad no encontrada');
  if (req.user.role !== 'admin' && !(req.user.role === 'representative' && church.representatives.some(x => x.equals(req.user._id))))
    throw new HttpError(403, 'FORBIDDEN', 'No puedes administrar esta comunidad');
  if(permission&&!require('./church-permissions').permissions(church,req.user).includes(permission))throw new HttpError(403,'FORBIDDEN','Tu función en esta iglesia no permite esta acción');
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

const searchVowels = {a:'[aá]', e:'[eé]', i:'[ií]', o:'[oó]', u:'[uúü]'};
function searchPattern(value){
  const normalized=value.normalize('NFC').toLowerCase().replace(/[áéíóúü]/g, ch=>ch.normalize('NFD')[0]);
  return Array.from(normalized,ch=>searchVowels[ch] ? searchVowels[ch]+'[\u0301\u0308]?' : escape(ch)).join('');
}
const conceptFields=['community.description','identification.distinctiveFeatures','location.address','christianIdentity.associatedTradition','christianIdentity.network','doctrine.officialStatement','meetingTypes','meetings.audience','meetings.modality','meetings.frequencyNotes','community.memberRange','leadership.mainLeader.name','leadership.mainLeader.role','leadership.otherLeaders.name','leadership.otherLeaders.role','firstVisit.instructions','firstVisit.welcomeProcess','media.title','contact.officeHours','identification.name','identification.abbreviation','identification.description','location.commune','location.city','location.region','christianIdentity.denomination','christianIdentity.branch','christianIdentity.languages','doctrine.characteristics','community.activities','community.ministries','community.targetGroups','meetings.type','meetings.schedule.day'];

//funcion para filtrar iglesias según parámetros de búsqueda
function filters(q, concepts=false) {
  const filter = { ...visible };
  const fields = { commune: 'location.commune', denomination: 'christianIdentity.denomination', branch: 'christianIdentity.branch',
    doctrine: 'doctrine.characteristics', activity: 'community.activities', language: 'christianIdentity.languages', day: 'meetings.schedule.day' };
  for (const [key, path] of Object.entries(fields)) if (q[key]) filter[path] = concepts ? new RegExp('^'+searchPattern(q[key])+'$', 'i') : exact(q[key]);
  if(concepts){
    for(const key of ['activities','ministries'])if(q[key])filter['community.'+key]={$all:q[key].map(tag=>new RegExp('^'+searchPattern(tag)+'$','i'))};
    if(q.images)filter.media={$elemMatch:{type:'image',url:/^https?:\/\//i}};
    if(q.supports){
      filter.$or=[{'privateFields.accessibilityDetails':false},{'privateFields.accessibilityDetails':{$exists:false},'privateFields.accessibilityLevel':{$ne:true}}];
      for(const key of q.supports)filter['location.accessibilityDetails.'+key]={$in:['yes','partial']};
    }
  }
  if(q.q)filter['identification.name']=new RegExp(concepts?searchPattern(q.q):escape(q.q),'i');
  if(concepts && q.keywords?.length){
    const clauses=q.keywords.map(word=>{
      const match=new RegExp(searchPattern(word),'i');
      const alternatives=conceptFields.map(path=>({[path]:match}));
      for(const path of ['community.musicalStyles','community.culturalStyle','doctrine.soteriology','doctrine.eschatology','contact.email','contact.phone'])
        alternatives.push({[path]:match,['privateFields.'+path.split('.')[1]]:{$ne:true}});
      alternatives.push({'location.accessNotes':match,'privateFields.accessibilityLevel':{$ne:true}},
        {'location.accessibilityDetails.additionalSupport':match,$or:[{'privateFields.accessibilityDetails':false},{'privateFields.accessibilityDetails':{$exists:false},'privateFields.accessibilityLevel':{$ne:true}}]});
      return {$or:alternatives};
    });
    filter.$and=q.conceptMode==='any'?[{$or:clauses}]:clauses;
  }
  return filter;
}

//funcion para buscar iglesias según parámetros de búsqueda, con paginación y ordenamiento por distancia si se proveen coordenadas
const cardProjection={'identification.name':1,'location.address':1,'location.commune':1,'location.coordinates':1,'christianIdentity.denomination':1,'community.activities':1,'meetings.type':1,'meetings.schedule':1,media:1,'metadata.dataStatus':1,'metadata.testData':1,distanceMeters:1};
function cardChurch(c){const images=(c.media||[]).filter(m=>m.type==='image'&&/^https?:\/\//i.test(m.url||'')),photo=images.find(m=>m.section==='recommendation')||images.find(m=>!m.section&&['banner','logo'].includes(m.category))||images.find(m=>!m.section&&(!m.category||m.category==='facilities')),meeting=(c.meetings||[]).flatMap(m=>(m.schedule||[]).map(t=>({...t,type:m.type}))).find(t=>t.day&&t.startTime);return {_id:c._id,identification:{name:c.identification?.name},location:c.location,christianIdentity:{denomination:c.christianIdentity?.denomination},community:{activities:(c.community?.activities||[]).slice(0,2)},media:photo?[photo]:[],meetings:meeting?[{type:meeting.type,schedule:[{day:meeting.day,startTime:meeting.startTime}]}]:[],metadata:{dataStatus:c.metadata?.dataStatus,testData:c.metadata?.testData},...(c.distanceMeters!==undefined?{distanceMeters:c.distanceMeters}:{})};}
async function search(q, excluded = [], cap) {
  const filter = {...filters(q,true),...discoveryExclusions};
  if (excluded.length) filter._id = { $nin: excluded };
  const limit = cap || q.limit || 20, page = q.page || 1;
  let rows, total;
  if (q.lat !== undefined && q.lng !== undefined) {
    const result = await Church.aggregate([
      { $geoNear: { near: { type: 'Point', coordinates: [q.lng, q.lat] }, key: 'location.coordinates', distanceField: 'distanceMeters',
        maxDistance: (q.radius || 5) * 1000, spherical: true, query: filter } },
      ...(q.view==='card'?[{$project:cardProjection}]:[]),
      { $sort: q.sort === 'name' ? { 'identification.name': 1, _id: 1 } : { distanceMeters: 1, _id: 1 } },
      { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'value' }] } }
    ]);
    rows = result[0].rows; total = result[0].total[0]?.value || 0;
  } else {
    [rows, total] = await Promise.all([Church.find(filter).select(q.view==='card'?cardProjection:null).sort({ 'identification.name': 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), Church.countDocuments(filter)]);
  }
  return { data: rows.map(q.view==='card'?cardChurch:publicChurch), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { visible, discoverable, discoveryExclusions, showcaseId, publicChurch, managed, filters, search, exact, checkVersion };
