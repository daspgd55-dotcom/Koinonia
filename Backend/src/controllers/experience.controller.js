const Experience=require('../models/experience.model'),Church=require('../models/church.model');
const {visible}=require('../services/church.service'),{HttpError}=require('../utils/errors'),v=require('../validation/schemas');
const categories=['long_term','new_member','youth','testimony'];
const pagination=v.z.strictObject({page:v.z.coerce.number().int().min(1).max(10000).default(1),limit:v.z.coerce.number().int().min(1).max(50).default(20)});
async function church(req){const id=v.parse(v.id,req.params.id);if(!await Church.exists({_id:id,...visible}))throw new HttpError(404,'NOT_FOUND','Comunidad no disponible');return id;}
async function listing(res,filter,q,fields,manage=false){const {page,limit}=q;let query=Experience.find(filter).select(fields+' author').populate({path:'author',select:'avatar.url active'}).sort({createdAt:-1,_id:1}).skip((page-1)*limit).limit(limit);if(manage)query=query.populate('church','identification.name');const [data,total]=await Promise.all([query.lean(),Experience.countDocuments(filter)]);res.set('Cache-Control','no-store').json({data:data.map(({author,...item})=>({...item,...(manage?{reports:(item.reports||[]).map(r=>({reason:r.reason,at:r.at,status:r.status,resolution:r.resolution}))}:{}),avatarUrl:author?.active!==false?author?.avatar?.url||null:null})),pagination:{page,limit,total}});}
exports.list=async(req,res)=>{const q=v.parse(pagination.extend({category:v.z.enum(categories).optional()}),req.query);return listing(res,{church:await church(req),status:'approved',...(q.category?{category:q.category}:{})},q,'title body displayName category createdAt');};
exports.mine=async(req,res)=>listing(res,{church:await church(req),author:req.user._id},v.parse(pagination,req.query),'title body displayName category status reason createdAt __v');
exports.create=async(req,res)=>{
 const id=await church(req);if(String(req.user.membershipChurch)!==id)throw new HttpError(403,'MEMBERSHIP_REQUIRED','Solo puedes escribir experiencias de la iglesia a la que perteneces.');
 const data=v.parse(v.z.strictObject({category:v.z.enum(categories),title:v.z.string().trim().min(5).max(120),body:v.z.string().trim().min(40).max(3000),displayName:v.z.string().trim().min(2).max(60)}),req.body);
 const item=await Experience.create({...data,church:id,author:req.user._id});
 res.set('Cache-Control','no-store').status(201).json({data:{_id:item._id,title:item.title,body:item.body,displayName:item.displayName,category:item.category,status:item.status,createdAt:item.createdAt}});
};
exports.manage=async(req,res)=>{const q=v.parse(pagination.extend({status:v.z.enum(['pending','approved','rejected','withdrawn']).default('pending'),reported:v.z.enum(['true']).optional()}),req.query);
 const filter=q.reported?{'reports.status':'pending'}:{status:q.status};if(req.user.role!=='admin')filter.church={$in:await Church.find({...require('../services/church-permissions').scope(req.user,'moderation'),active:true}).distinct('_id')};
 return listing(res,filter,q,'title body displayName category church status reason createdAt __v reports',true);
};
exports.moderate=async(req,res)=>{
 const id=v.parse(v.id,req.params.id),data=v.parse(v.z.strictObject({status:v.z.enum(['approved','rejected','resolve']),reason:v.z.string().trim().max(1000).optional(),version:v.z.number().int().min(0)}).refine(x=>x.status!=='rejected'||x.reason?.length>=5,{message:'Indica el motivo del rechazo (mínimo 5 caracteres)'}),req.body);
 const current=await Experience.findById(id).select('church status reports');
 if(!current)throw new HttpError(404,'NOT_FOUND','Experiencia no encontrada');
 if(req.user.role!=='admin'&&!await Church.exists({_id:current.church,...require('../services/church-permissions').scope(req.user,'moderation'),active:true}))throw new HttpError(403,'FORBIDDEN','Solo puedes moderar experiencias de tus comunidades asignadas.');
 if(current.status==='withdrawn'&&data.status!=='resolve')throw new HttpError(409,'WITHDRAWN','El autor retiró esta experiencia.');
 if(data.status==='resolve'&&(!data.reason||data.reason.length<5))throw new HttpError(400,'REASON_REQUIRED','Explica la resolución del reporte.');
 const status=data.status==='resolve'?current.status:data.status;
 const item=await Experience.findOneAndUpdate({_id:id,__v:data.version},{$set:{status,...(data.status!=='resolve'?{reason:data.reason||''}:{}),...(current.reports?.some(r=>r.status==='pending')?{'reports.$[pending].status':'resolved','reports.$[pending].resolvedBy':req.user._id,'reports.$[pending].resolvedAt':new Date(),'reports.$[pending].resolution':data.reason||'Contenido revisado'}:{})},$inc:{__v:1},$push:{moderationLog:{status:data.status,reason:data.reason||'',by:req.user._id,at:new Date()}}},{returnDocument:'after',runValidators:true,...(current.reports?.some(r=>r.status==='pending')?{arrayFilters:[{'pending.status':'pending'}]}:{})});
 if(!item)throw new HttpError(409,'STALE_VERSION','La experiencia cambió o ya no existe. Recarga la lista.');res.set('Cache-Control','no-store').json({data:{_id:item._id,status:item.status,version:item.__v}});
};

const content=v.z.strictObject({category:v.z.enum(categories),title:v.z.string().trim().min(5).max(120),body:v.z.string().trim().min(40).max(3000),displayName:v.z.string().trim().min(2).max(60),version:v.z.number().int().min(0)});
exports.edit=async(req,res)=>{
 const data=v.parse(content,req.body),id=v.parse(v.id,req.params.id),current=await Experience.findOne({_id:id,author:req.user._id});
 if(!current)throw new HttpError(404,'NOT_FOUND','Experiencia no encontrada');
 if(String(req.user.membershipChurch)!==String(current.church))throw new HttpError(403,'MEMBERSHIP_REQUIRED','Asocia esta iglesia para volver a enviar tu experiencia.');
 if(!await Church.exists({_id:current.church,...visible}))throw new HttpError(409,'UNAVAILABLE','La comunidad no está disponible.');
 const {version,...fields}=data;
 const item=await Experience.findOneAndUpdate({_id:id,author:req.user._id,__v:version},{$set:{...fields,status:'pending',reason:''},$inc:{__v:1},$push:{moderationLog:{status:'pending',reason:'Edición del autor; requiere nueva revisión',by:req.user._id,at:new Date()}}},{returnDocument:'after',runValidators:true});
 if(!item)throw new HttpError(409,'STALE_VERSION','La experiencia cambió. Recarga antes de editar.');
 res.set('Cache-Control','no-store').json({ok:true});
};
exports.withdraw=async(req,res)=>{
 const {version}=v.parse(v.z.strictObject({version:v.z.number().int().min(0)}),req.body),id=v.parse(v.id,req.params.id);
 const current=await Experience.findOne({_id:id,author:req.user._id});if(!current)throw new HttpError(404,'NOT_FOUND','Experiencia no encontrada');
 const item=await Experience.findOneAndUpdate({_id:id,author:req.user._id,__v:version},{$set:{status:'withdrawn'},$inc:{__v:1},$push:{moderationLog:{status:'withdrawn',reason:'Retirada por su autor',by:req.user._id,at:new Date()}}},{returnDocument:'after'});
 if(!item)throw new HttpError(409,'STALE_VERSION','La experiencia cambió. Recarga antes de retirarla.');res.json({ok:true});
};
exports.report=async(req,res)=>{
 const {reason}=v.parse(v.z.strictObject({reason:v.z.string().trim().min(5).max(1000)}),req.body),id=v.parse(v.id,req.params.id),current=await Experience.findOne({_id:id,status:'approved'});
 if(!current||!await Church.exists({_id:current.church,...visible}))throw new HttpError(404,'NOT_FOUND','Experiencia no disponible');
 const item=await Experience.findOneAndUpdate({_id:id,status:'approved',reports:{$not:{$elemMatch:{by:req.user._id,status:'pending'}}}},{$push:{reports:{by:req.user._id,reason,at:new Date(),status:'pending'}},$inc:{__v:1}},{returnDocument:'after'});
 if(!item)throw new HttpError(409,'REPORT_PENDING','Ya hay un reporte tuyo pendiente o el contenido cambió.');
 res.status(201).json({ok:true});
};
