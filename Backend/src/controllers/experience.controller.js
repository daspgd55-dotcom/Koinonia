const Experience=require('../models/experience.model'),Church=require('../models/church.model');
const {visible}=require('../services/church.service'),{HttpError}=require('../utils/errors'),v=require('../validation/schemas');
const categories=['long_term','new_member','youth','testimony'];
const pagination=v.z.strictObject({page:v.z.coerce.number().int().min(1).max(10000).default(1),limit:v.z.coerce.number().int().min(1).max(50).default(20)});
async function church(req){const id=v.parse(v.id,req.params.id);if(!await Church.exists({_id:id,...visible}))throw new HttpError(404,'NOT_FOUND','Comunidad no disponible');return id;}
async function listing(res,filter,q,fields,manage=false){const {page,limit}=q;let query=Experience.find(filter).select(fields+' author').populate({path:'author',select:'avatar.url active'}).sort({createdAt:-1,_id:1}).skip((page-1)*limit).limit(limit);if(manage)query=query.populate('church','identification.name');const [data,total]=await Promise.all([query.lean(),Experience.countDocuments(filter)]);res.set('Cache-Control','no-store').json({data:data.map(({author,...item})=>({...item,avatarUrl:author?.active!==false?author?.avatar?.url||null:null})),pagination:{page,limit,total}});}
exports.list=async(req,res)=>{const q=v.parse(pagination.extend({category:v.z.enum(categories).optional()}),req.query);return listing(res,{church:await church(req),status:'approved',...(q.category?{category:q.category}:{})},q,'title body displayName category createdAt');};
exports.mine=async(req,res)=>listing(res,{church:await church(req),author:req.user._id},v.parse(pagination,req.query),'title body displayName category status reason createdAt');
exports.create=async(req,res)=>{
 const id=await church(req);if(String(req.user.membershipChurch)!==id)throw new HttpError(403,'MEMBERSHIP_REQUIRED','Solo puedes escribir experiencias de la iglesia a la que perteneces.');
 const data=v.parse(v.z.strictObject({category:v.z.enum(categories),title:v.z.string().trim().min(5).max(120),body:v.z.string().trim().min(40).max(3000),displayName:v.z.string().trim().min(2).max(60)}),req.body);
 const item=await Experience.create({...data,church:id,author:req.user._id});
 res.set('Cache-Control','no-store').status(201).json({data:{_id:item._id,title:item.title,body:item.body,displayName:item.displayName,category:item.category,status:item.status,createdAt:item.createdAt}});
};
exports.manage=async(req,res)=>{const q=v.parse(pagination.extend({status:v.z.enum(['pending','approved','rejected']).default('pending')}),req.query);
 const filter={status:q.status};if(req.user.role!=='admin')filter.church={$in:await Church.find({representatives:req.user._id,active:true}).distinct('_id')};
 return listing(res,filter,q,'title body displayName category church status reason createdAt __v',true);
};
exports.moderate=async(req,res)=>{
 const id=v.parse(v.id,req.params.id),data=v.parse(v.z.strictObject({status:v.z.enum(['approved','rejected']),reason:v.z.string().trim().max(1000).optional(),version:v.z.number().int().min(0)}).refine(x=>x.status!=='rejected'||x.reason?.length>=5,{message:'Indica el motivo del rechazo (mínimo 5 caracteres)'}),req.body);
 const current=await Experience.findById(id).select('church');
 if(!current)throw new HttpError(404,'NOT_FOUND','Experiencia no encontrada');
 if(req.user.role!=='admin'&&!await Church.exists({_id:current.church,representatives:req.user._id,active:true}))throw new HttpError(403,'FORBIDDEN','Solo puedes moderar experiencias de tus comunidades asignadas.');
 const item=await Experience.findOneAndUpdate({_id:id,__v:data.version},{$set:{status:data.status,reason:data.reason||''},$inc:{__v:1},$push:{moderationLog:{status:data.status,reason:data.reason||'',by:req.user._id,at:new Date()}}},{returnDocument:'after',runValidators:true});
 if(!item)throw new HttpError(409,'STALE_VERSION','La experiencia cambió o ya no existe. Recarga la lista.');res.set('Cache-Control','no-store').json({data:{_id:item._id,status:item.status,version:item.__v}});
};
