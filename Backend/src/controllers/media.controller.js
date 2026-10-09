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
  const b = req.body, type = req.get('Content-Type');
  const valid = Buffer.isBuffer(b) && ((type === 'image/jpeg' && b.subarray(0,3).equals(Buffer.from([255,216,255]))) || (type === 'image/png' && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (type === 'image/webp' && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP'));
  if (!valid) throw new HttpError(400, 'INVALID_IMAGE', 'Selecciona una imagen JPEG, PNG o WebP válida.');
  if (c.media.filter(x => x.type === 'image').length >= 5 || c.media.length >= 30) throw new HttpError(400, 'MEDIA_LIMIT', 'Esta comunidad ya alcanzó el límite de fotos.');
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
      $push: { media: { type: 'image', url: image.secure_url, source: 'Subida por representante autorizado' } },
      $set: { 'metadata.dataStatus': 'draft', updatedBy: req.user._id, 'verification.lastUpdated': new Date() }, $inc: { 'metadata.version': 1 }
    }, { new: true, runValidators: true });
    if (!data) throw new HttpError(409, 'STALE_VERSION', 'La ficha cambió en otra sesión. Recarga antes de guardar.');
    res.status(201).json({ data });
  } catch (error) {
    try { await transport(endpoint + 'destroy', { method: 'POST', headers, body: new URLSearchParams({ public_id: publicId, invalidate: 'true' }), signal: AbortSignal.timeout(10000) }); } catch { console.error('MEDIA_CLEANUP_FAILED'); }
    throw error;
  }
};
