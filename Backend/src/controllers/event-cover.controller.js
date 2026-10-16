const {randomUUID}=require('node:crypto'),Event=require('../models/event.model');
const {managed}=require('./event.controller'),{expectedVersion}=require('../utils/resource-version'),{HttpError}=require('../utils/errors');
exports.authorize=async(req,res,next)=>{const {event:data}=await managed(req),version=expectedVersion(req);if(data.version!==version)throw new HttpError(409,'STALE_VERSION','El evento cambió en otra sesión. Recarga antes de guardar.');req.event=data;next();};
exports.upload=async(req,res)=>{
 const c=req.event,cfg=req.app.locals.config.cloudinary,frame=req.query.frame||'landscape';
 if(!['landscape','wide','square','circle','portrait'].includes(frame))throw new HttpError(400,'INVALID_FRAME','Marco inválido.');
 const b=req.body,type=req.get('Content-Type'),valid=Buffer.isBuffer(b)&&((type==='image/jpeg'&&b.subarray(0,3).equals(Buffer.from([255,216,255])))||(type==='image/png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(type==='image/webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'));
 if(!valid)throw new HttpError(400,'INVALID_IMAGE','Selecciona una imagen JPEG, PNG o WebP válida.');
 if(!cfg)throw new HttpError(503,'MEDIA_UNAVAILABLE','La subida de fotos aún no está configurada.');
 const id='koinonia/events/'+c._id+'/'+randomUUID(),endpoint='https://api.cloudinary.com/v1_1/'+cfg.cloudName+'/image/',headers={Authorization:'Basic '+Buffer.from(cfg.apiKey+':'+cfg.apiSecret).toString('base64')},transport=req.app.locals.mediaFetch||fetch,form=new FormData();
 form.set('file',new Blob([b],{type}),'image');form.set('public_id',id);form.set('overwrite','false');form.set('transformation','c_limit,w_1600,h_1600/q_auto/f_webp');
 let image;try{const r=await transport(endpoint+'upload',{method:'POST',headers,body:form,signal:AbortSignal.timeout(45000)});image=await r.json();if(!r.ok||image.public_id!==id||!image.secure_url?.startsWith('https://res.cloudinary.com/'+cfg.cloudName+'/'))throw Error();}catch{throw new HttpError(502,'UPLOAD_FAILED','No pudimos subir la foto. Conservamos tu ficha.');}
 try{await managed(req);const data=await Event.findOneAndUpdate({_id:c._id,version:c.version},{$set:{cover:{url:image.secure_url,source:'Subida por representante autorizado',frame},updatedBy:req.user._id},$inc:{version:1}},{returnDocument:'after',runValidators:true});if(!data)throw new HttpError(409,'STALE_VERSION','El evento cambió en otra sesión. Recarga antes de guardar.');res.status(201).set('Cache-Control','no-store').json({data:Object.fromEntries(Object.entries(data.toObject()).filter(([k])=>k!=='participationChanges'))});}
 catch(e){try{await transport(endpoint+'destroy',{method:'POST',headers,body:new URLSearchParams({public_id:id,invalidate:'true'}),signal:AbortSignal.timeout(10000)});}catch{console.error('EVENT_COVER_CLEANUP_FAILED');}throw e;}
};
