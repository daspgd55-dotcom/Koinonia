const Church = require('../models/church.model');
const User = require('../models/user.model');
const v = require('../validation/schemas');
const svc = require('../services/church.service');
const { HttpError } = require('../utils/errors');
exports.list = async (req, res) => {
  const query = v.parse(v.search, req.query);
  if (req.path.endsWith('/nearby') && query.lat === undefined) throw new HttpError(400, 'VALIDATION_ERROR', 'nearby requiere lat y lng');
  res.json(await svc.search(query));
};
exports.get = async (req, res) => {
  const church = await Church.findOne({ _id: v.parse(v.id, req.params.id), ...svc.visible });
  if (!church) throw new HttpError(404, 'NOT_FOUND', 'Comunidad no encontrada');
  res.json({ data: svc.publicChurch(church) });
};
exports.mine = async (req, res) => {
  const q = v.parse(v.z.strictObject({ q: v.z.string().trim().max(200).optional(), commune: v.z.string().trim().max(200).optional(),
    denomination: v.z.string().trim().max(200).optional(), status: v.z.enum(['draft', 'published', 'verified']).optional(),
    publicationRequest: v.z.literal('pending').optional(), active: v.z.enum(['active', 'inactive', 'all']).default('active'),
    page: v.z.coerce.number().int().min(1).max(10000).default(1), limit: v.z.coerce.number().int().min(1).max(100).default(20) }), req.query);
  const filter = svc.filters(q); delete filter.active; delete filter['metadata.dataStatus'];
  if (q.active !== 'all') filter.active = q.active === 'active';
  if(q.publicationRequest)filter['publicationRequest.status']=q.publicationRequest;
  if (q.status) filter['metadata.dataStatus'] = q.status;
  if (req.user.role !== 'admin') filter.representatives = req.user._id;
  const [data, total] = await Promise.all([Church.find(filter).sort({ 'identification.name': 1, _id: 1 }).skip((q.page - 1) * q.limit).limit(q.limit), Church.countDocuments(filter)]);
  res.json({ data, pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } });
};
exports.detail = async (req, res) => {
  const church = await svc.managed(req, { includeInactive: true });
  const assignedAccounts = await User.find({ _id: { $in: church.representatives },active:true }).select(req.user.role==='admin'?'_id name email role':'_id name role').lean();
  res.set('ETag', '"' + church.metadata.version + '"').json({ data: church, ...(assignedAccounts ? { assignedAccounts } : {}) });
};
// Reparación explícita de identificadores antiguos, sin guardar la ficha ni cambiar su publicación.
exports.leaderIdentifiers = async (req, res) => {
  const church=await svc.managed(req,{includeInactive:true});
  svc.checkVersion(req,church);
  let changed=false;
  for(const leader of [church.leadership?.mainLeader,...(church.leadership?.otherLeaders||[])])
    if(leader?.name&&!leader.id){leader.id=require('node:crypto').randomUUID();changed=true;}
  if(changed){church.metadata.version+=1;await church.save();}
  res.set('ETag','"'+church.metadata.version+'"').json({data:church});
};
async function validateVisitSettings(data,assigned){if(!data.visitSettings)return;const ids=[...new Set(data.visitSettings.representativeIds)];if(ids.some(id=>!assigned.map(String).includes(id)))throw new HttpError(400,'INVALID_VISIT_STAFF','Selecciona representantes actualmente asociados a esta iglesia.');const count=await User.countDocuments({_id:{$in:ids},active:true,role:{$in:['representative','admin']}});if(count!==ids.length)throw new HttpError(400,'INVALID_VISIT_STAFF','Las cuentas seleccionadas deben estar activas y tener un rol autorizado.');data.visitSettings.representativeIds=ids;data.visitSettings.emailRecipients=[...new Set(data.visitSettings.emailRecipients)];if(data.visitSettings.emailEnabled&&!data.visitSettings.emailRecipients.length)throw new HttpError(400,'VISIT_EMAIL_REQUIRED','Añade al menos un correo para activar los avisos.');}
exports.create = async (req, res) => {
  const data = normalizeDetails(v.parse(v.church, req.body));
  await validateVisitSettings(data,[req.user._id]);
  const church = await Church.create({ ...data, verification: { ...data.verification, lastUpdated: new Date() },
    representatives: [req.user._id], createdBy: req.user._id, updatedBy: req.user._id });
  res.status(201).json({ data: church });
};
exports.update = async (req, res) => {
  const church = await svc.managed(req);
  svc.checkVersion(req, church);
  const data = normalizeDetails(v.parse(v.church, req.body));
  await validateVisitSettings(data,church.representatives);
  // PUT reemplaza la ficha editable, preservando identidad, permisos y metadatos técnicos.
  for (const key of Object.keys(v.church.shape)) {
    if (['privateFields','meetingTypes','visitSettings'].includes(key) && data[key] === undefined) continue;
    church.set(key, data[key]);
  }
  church.verification.lastUpdated = new Date();
  // La edición conserva la visibilidad; la verificación se renueva por separado.
  if (church.metadata.dataStatus === 'verified') church.metadata.dataStatus = 'published';
  church.metadata.version += 1; church.updatedBy = req.user._id;
  await church.save(); res.json({ data: church });
};
exports.status = async (req, res) => {
  const church = await svc.managed(req);
  svc.checkVersion(req, church);
  const { status } = v.parse(v.z.strictObject({ status: v.z.enum(['draft', 'published', 'verified']) }), req.body);
  if (req.user.role !== 'admin' && (status === 'verified' || !church.metadata.firstPublishedByAdminAt)) throw new HttpError(403, 'ADMIN_PUBLICATION_REQUIRED', 'Un administrador debe publicar primero esta comunidad. Solo el administrador puede verificarla.');
  if (req.user.role === 'admin' && status !== 'draft' && !church.metadata.firstPublishedByAdminAt) church.metadata.firstPublishedByAdminAt = new Date();
  if (status !== 'draft') {
    const missing = require('../services/church-quality.service').checklist(church).missing.map(x=>x.key);
    if (missing.length) throw new HttpError(400, 'INCOMPLETE_CHURCH', 'Faltan datos esenciales para publicar', missing);
  }
  if((status==='verified'||status==='published'&&!church.publicationRequest?.verificationRequested)&&church.publicationRequest?.status==='pending')church.publicationRequest.status='resolved';
  church.metadata.dataStatus = status; church.metadata.version += 1; church.updatedBy = req.user._id;
  await church.save(); res.json({ data: church });
};
exports.representatives = async (req, res) => {
  const church = await svc.managed(req);
  svc.checkVersion(req, church);
  const { userIds } = v.parse(v.z.strictObject({ userIds: v.z.array(v.id).min(1).max(20).refine(a => new Set(a).size === a.length) }), req.body);
  const count = await User.countDocuments({ _id: { $in: userIds }, role: { $in: ['representative', 'admin'] }, active: true });
  if (count !== userIds.length) throw new HttpError(400, 'INVALID_REPRESENTATIVES', 'Todos deben ser representantes o administradores activos');
  church.representatives = userIds; church.updatedBy = req.user._id; church.metadata.version += 1;
  await church.save(); res.json({ data: church });
};
exports.remove = async (req, res) => {
  const church = await svc.managed(req);
  svc.checkVersion(req, church);
  church.active = false; church.updatedBy = req.user._id; church.metadata.version += 1;
  await church.save(); res.status(204).end();
};
exports.restore = async (req, res) => {
  const church = await svc.managed(req, { includeInactive: true });
  if (church.mergedInto) throw new HttpError(409, 'MERGED_CHURCH', 'Esta ficha fue fusionada. Gestiona la ficha ' + church.mergedInto);
  svc.checkVersion(req, church);
  if (church.active) throw new HttpError(409, 'ALREADY_ACTIVE', 'La comunidad ya está activa');
  church.active = true; church.metadata.dataStatus = 'draft'; church.metadata.version += 1; church.updatedBy = req.user._id;
  await church.save(); res.json({ data: church });
};

exports.eligibleRepresentatives = async (req, res) => {
  const { email, page, limit } = v.parse(v.z.strictObject({ email: v.z.string().trim().email().max(254).toLowerCase().optional(), page: v.z.coerce.number().int().min(1).default(1), limit: v.z.coerce.number().int().min(1).max(100).default(100) }), req.query);
  const filter = { ...(email ? { email } : {}), active: true, role: 'representative' };
  const [data,total] = await Promise.all([User.find(filter).select('_id name email role position').sort({ email: 1 }).skip((page-1)*limit).limit(limit).lean(), User.countDocuments(filter)]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total/limit) } });
};
exports.createRepresentative = async (req, res) => {
  if(require('../services/account-security.service').enabled(req.app.locals.config))return require('./email-verification.controller').invite(req,res);
  const data = v.parse(v.z.strictObject({ name: v.z.string().trim().min(1).max(100), email: v.z.string().trim().email().max(254).toLowerCase(), position: v.z.string().trim().min(1).max(200), password: v.z.union([v.password,v.z.literal('')]).optional() }), req.body);
  const password = data.password || require('node:crypto').randomBytes(18).toString('base64url');
  const user = await User.create({ ...data, password: await require('bcryptjs').hash(password, 12), role: 'representative', onboarding: { status: 'skipped', version: 3, lastStep: 0 } });
  res.set('Cache-Control', 'no-store').status(201).json({ data: { _id: user.id, name: user.name, email: user.email, position: user.position, role: user.role }, initialPassword: password });
};

function normalizeDetails(data) {
 for(const m of data.meetings||[])if(!m.id)m.id=require('node:crypto').randomUUID();
 if(new Set((data.meetings||[]).map(m=>m.id)).size!==(data.meetings||[]).length)throw new HttpError(400,'INVALID_MEETING','Las reuniones deben tener identificadores únicos.');
  const leaders=[data.leadership?.mainLeader,...(data.leadership?.otherLeaders||[])].filter(Boolean),ids=leaders.map(l=>l.id).filter(Boolean);
  if(new Set(ids).size!==ids.length) throw new HttpError(400,'INVALID_LEADER','Los identificadores de representantes deben ser únicos.');
  for(const m of data.media||[])if(m.frame&&((m.category==='representatives'&&!['circle','square'].includes(m.frame))||(m.category==='banner'&&!['wide','landscape'].includes(m.frame))))throw new HttpError(400,'INVALID_FRAME','El marco no corresponde al tipo de recurso.');
  for(const m of data.media||[])if(m.section==='representatives'&&(!m.leaderId||m.category!=='representatives'))throw new HttpError(400,'INVALID_LEADER','Para mostrar un retrato en Representantes, selecciona la persona asociada.');
  for(const m of data.media||[])if(m.leaderId&&(m.category!=='representatives'||!leaders.some(l=>l.id===m.leaderId&&l.name)))throw new HttpError(400,'INVALID_LEADER','La foto debe asociarse a un representante de esta ficha.');

  for (const [group, detail, legacy] of [['location', 'parkingAvailability', 'parking'], ['location', 'accessibilityLevel', 'accessibility'], ['firstVisit', 'welcomeSupport', 'newVisitorSupport']]) {
    const value = data[group]?.[detail];
    if (value) { if (['yes', 'no'].includes(value)) data[group][legacy] = value === 'yes'; else delete data[group][legacy]; }
  }
  return data;
}

exports.requestPublication=async(req,res)=>{
 const church=await svc.managed(req);svc.checkVersion(req,church);
 const {verificationRequested=false}=v.parse(v.z.strictObject({verificationRequested:v.z.boolean().optional()}),req.body||{});
 if(church.metadata.dataStatus==='verified'||!verificationRequested&&(church.metadata.firstPublishedByAdminAt||church.metadata.dataStatus!=='draft'))throw new HttpError(409,'ALREADY_PUBLISHED','La comunidad ya tiene este estado.');
 if(church.publicationRequest?.status!=='pending'||verificationRequested&&!church.publicationRequest.verificationRequested){church.publicationRequest={status:'pending',verificationRequested,requestedBy:req.user._id,requestedAt:new Date()};church.metadata.version+=1;church.updatedBy=req.user._id;await church.save();}
 res.json({data:church});
};

exports.checklist=async(req,res)=>res.set('Cache-Control','no-store').json({data:require('../services/church-quality.service').checklist(await svc.managed(req,{includeInactive:true}))});

exports.meetingIdentifiers=async(req,res)=>{const c=await svc.managed(req,{includeInactive:true});svc.checkVersion(req,c);let changed=false;for(const m of c.meetings||[])if(!m.id){m.id=require('node:crypto').randomUUID();changed=true;}if(changed){c.metadata.version+=1;await c.save();}res.set('ETag','"'+c.metadata.version+'"').json({data:c});};
