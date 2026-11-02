const { randomUUID } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const Church = require('../models/church.model');
const svc = require('../services/church.service');
const { HttpError } = require('../utils/errors');
exports.limit = rateLimit({ windowMs: 3600000, limit: 20, keyGenerator: req => String(req.user._id), standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'UPLOAD_LIMIT', message: 'Límite de subidas alcanzado. Intenta más tarde.' } } });
exports.authorize = async (req, res, next) => { req.church = await svc.managed(req); if (!req.get('If-Match')) throw new HttpError(428, 'VERSION_REQUIRED', 'Recarga la ficha antes de subir una foto.'); svc.checkVersion(req, req.church); next(); };
exports.upload = async (req, res) => {
  const c = req.church, config = req.app.locals.config.cloudinary;
  if (!config) throw new HttpError(503, 'MEDIA_UNAVAILABLE', 'La subida de fotos aún no está configurada.');
  const category = req.query.category || 'facilities';
  if (!['facilities','meetings','activities','representatives','banner','logo'].includes(category)) throw new HttpError(400, 'INVALID_CATEGORY', 'Categoría multimedia inválida.');
  const frame=req.query.frame||({banner:'wide',representatives:'circle',logo:'square'}[category]||'landscape'),leaderId=req.query.leaderId;
  if(!['landscape','wide','square','circle','portrait'].includes(frame))throw new HttpError(400,'INVALID_FRAME','Marco inválido.');
  if((category==='representatives'&&!['circle','square'].includes(frame))||(category==='banner'&&!['wide','landscape'].includes(frame)))throw new HttpError(400,'INVALID_FRAME','El marco no corresponde al tipo de recurso.');
  if(category==='representatives'&&(!leaderId||![c.leadership?.mainLeader,...(c.leadership?.otherLeaders||[])].some(l=>l?.id===leaderId&&l.name)))throw new HttpError(400,'INVALID_LEADER','Guarda primero el representante en Liderazgo y contacto y selecciona su nombre.');
  if(leaderId&&category!=='representatives')throw new HttpError(400,'INVALID_LEADER','La asociación solo corresponde a representantes.');
  const b = req.body, type = req.get('Content-Type');
  const valid = Buffer.isBuffer(b) && ((type === 'image/jpeg' && b.subarray(0,3).equals(Buffer.from([255,216,255]))) || (type === 'image/png' && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (type === 'image/webp' && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP'));
  if (!valid) throw new HttpError(400, 'INVALID_IMAGE', 'Selecciona una imagen JPEG, PNG o WebP válida.');
  if (c.media.filter(x => x.type === 'image').length >= 10 || c.media.length >= 30) throw new HttpError(400, 'MEDIA_LIMIT', 'Esta iglesia ya alcanzó el límite de fotos.');
  const publicId = 'koinonia/' + c.id + '/' + randomUUID(), form = new FormData();
  form.set('file', new Blob([b], { type }), 'image'); form.set('public_id', publicId);
  form.set('overwrite', 'false'); form.set('transformation', 'c_limit,w_1600,h_1600/q_auto/f_webp');
  const headers = { Authorization: 'Basic ' + Buffer.from(config.apiKey + ':' + config.apiSecret).toString('base64') };
  const endpoint = 'https://api.cloudinary.com/v1_1/' + config.cloudName + '/image/';
  const transport = req.app.locals.mediaFetch || fetch;
  let image;
  try { const r = await transport(endpoint + 'upload', { method: 'POST', headers, body: form, signal: AbortSignal.timeout(45000) }); image = await r.json(); if (!r.ok || image.public_id !== publicId || !image.secure_url?.startsWith('https://res.cloudinary.com/' + config.cloudName + '/')) throw Error('invalid provider response'); }
  catch { throw new HttpError(502, 'UPLOAD_FAILED', 'No pudimos subir la foto. La ficha conserva sus datos; intenta nuevamente.'); }
  try {
    const data = await Church.findOneAndUpdate({ _id: c._id, active: true, 'metadata.version': c.metadata.version, ...(req.user.role === 'admin' ? {} : { representatives: req.user._id }) }, {
      $push: { media: { type: 'image', category, frame, ...(leaderId?{leaderId}:{}), url: image.secure_url, source: 'Subida por representante autorizado' } },
      $set: { 'metadata.dataStatus': c.metadata.dataStatus === 'verified' ? 'published' : c.metadata.dataStatus, updatedBy: req.user._id, 'verification.lastUpdated': new Date() }, $inc: { 'metadata.version': 1, __v: 1 }
    }, { returnDocument: 'after', runValidators: true });
    if (!data) throw new HttpError(409, 'STALE_VERSION', 'La ficha cambió en otra sesión. Recarga antes de guardar.');
    res.status(201).json({ data });
  } catch (error) {
    try { await transport(endpoint + 'destroy', { method: 'POST', headers, body: new URLSearchParams({ public_id: publicId, invalidate: 'true' }), signal: AbortSignal.timeout(10000) }); } catch { console.error('MEDIA_CLEANUP_FAILED'); }
    throw error;
  }
};
exports.remove = async (req,res) => {
  const c=req.church,index=Number(req.params.index);
  if(!/^\d+$/.test(req.params.index)||!Number.isSafeInteger(index)||!c.media[index])throw new HttpError(400,'INVALID_MEDIA','Selecciona una foto existente.');
  const item=c.media[index], remaining=c.media.filter((_,i)=>i!==index);
  const data=await Church.findOneAndUpdate({_id:c._id,active:true,'metadata.version':c.metadata.version,...(req.user.role==='admin'?{}:{representatives:req.user._id})},{$set:{media:remaining,'metadata.dataStatus':c.metadata.dataStatus === 'verified' ? 'published' : c.metadata.dataStatus,updatedBy:req.user._id,'verification.lastUpdated':new Date()},$inc:{'metadata.version':1,__v:1}},{returnDocument:'after',runValidators:true});
  if(!data)throw new HttpError(409,'STALE_VERSION','La ficha cambió en otra sesión. Recarga antes de guardar.');
  // Solo eliminar recursos subidos por esta aplicación y pertenecientes a esta comunidad.
  let warning;const cfg=req.app.locals.config.cloudinary;
  if(cfg){const prefix='https://res.cloudinary.com/'+cfg.cloudName+'/image/upload/';const path=item.url.startsWith(prefix)?item.url.slice(prefix.length):'';
    const match=/^(?:v\d+\/)?(koinonia\/[a-f0-9]{24}\/[a-f0-9-]{36})\.webp$/.exec(path);
    if(match&&match[1].startsWith('koinonia/'+c.id+'/'))try{const r=await(req.app.locals.mediaFetch||fetch)('https://api.cloudinary.com/v1_1/'+cfg.cloudName+'/image/destroy',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(cfg.apiKey+':'+cfg.apiSecret).toString('base64')},body:new URLSearchParams({public_id:match[1],invalidate:'true'}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('cleanup');}catch{warning='Foto retirada de la ficha. No se pudo limpiar el archivo remoto; el administrador puede eliminarlo desde Cloudinary.';console.error('MEDIA_CLEANUP_FAILED');}
  }
  res.json({data,...(warning?{warning}:{})});
};
