const Invitation=require('../models/church-outreach-invitation.model'),Church=require('../models/church.model'),{z,id,parse}=require('../validation/schemas'),{expectedVersion}=require('../utils/resource-version'),svc=require('../services/church-outreach-admin.service');
const text=z.string().trim().min(1).max(2000),email=z.string().trim().toLowerCase().email().max(254),roles=z.enum(['administrator','editor','moderator','welcome']);
const reviews=z.discriminatedUnion('action',[
 z.strictObject({action:z.literal('clarify'),reason:z.string().trim().max(2000).default(''),message:text}),z.strictObject({action:z.literal('reject'),reason:z.string().trim().max(2000).default('')}),
 z.strictObject({action:z.literal('people'),reason:z.string().trim().max(2000).default(''),targetFingerprint:z.string().length(64),people:z.array(z.strictObject({email,state:z.enum(['approved','rejected']),subrole:roles,changeExistingRole:z.boolean().default(false)})).min(1).max(20).refine(p=>new Set(p.map(x=>x.email)).size===p.length,'No repitas personas')})
]);
const reply=(res,result)=>res.set('Cache-Control','no-store').set('ETag','"'+result.data.version+'"').json(result);
exports.detail=async(req,res)=>reply(res,await svc.context(parse(id,req.params.id)));
exports.review=async(req,res)=>{const row=await svc.review(parse(id,req.params.id),expectedVersion(req),parse(reviews,req.body),req.user,req.app.locals.config,parse(z.string().uuid(),req.get('Idempotency-Key')));reply(res,await svc.context(row._id));};
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
exports.churches=async(req,res)=>{
 const q=parse(z.strictObject({q:z.string().trim().max(120).default(''),page:z.coerce.number().int().min(1).max(10000).default(1)}),req.query),pattern=new RegExp(escaped(q.q),'i'),filter=q.q?{$or:[{'identification.name':pattern},{'location.commune':pattern},{'location.city':pattern}]}:{};
 const [data,total]=await Promise.all([Church.find(filter).select('identification.name location.address location.commune location.city contact.email active metadata.dataStatus mergedInto').sort({'identification.name':1,_id:1}).skip((q.page-1)*20).limit(20).lean(),Church.countDocuments(filter)]);res.set('Cache-Control','no-store').json({data,total,page:q.page});
};
exports.related=async(req,res)=>{const q=parse(z.strictObject({churchId:id,email:email.optional()}),req.query),filter={active:true,expiresAt:{$gt:new Date()},$or:[{church:q.churchId},...(q.email?[{'recipient.email':q.email}]:[])]};const [data,total]=await Promise.all([Invitation.find(filter).select('reference church recipient lifecycle response.state expiresAt').populate('church','identification.name').sort({createdAt:-1}).limit(30).lean(),Invitation.countDocuments(filter)]);res.set('Cache-Control','no-store').json({data,total});};
exports.inbox=async(req,res)=>{
 const q=parse(z.strictObject({q:z.string().trim().max(120).default(''),trash:z.enum(['true','false']).default('false'),stage:z.enum(['all','contact','waiting','proposals','activation','closed']).default('all'),delivery:z.enum(['not_sent','queued','accepted','delivered','failed','bounced','cancelled']).optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}),req.query),pattern=new RegExp(escaped(q.q),'i');
 const pipeline=[{$match:{trashedAt:q.trash==='true'?{$ne:null}:null}},{$lookup:{from:Church.collection.name,localField:'church',foreignField:'_id',as:'institution'}},{$unwind:{path:'$institution',preserveNullAndEmptyArrays:true}},{$set:{stage:{$switch:{branches:[
  {case:{$or:[{$in:['$lifecycle',['expired','revoked','closed']]},{$lte:['$expiresAt',new Date()]},{$eq:['$noContact.requested',true]}]},then:'closed'},
  {case:{$in:['approved',{$ifNull:['$proposedRepresentatives.reviewState',[]]}]},then:'activation'},
  {case:{$in:['$response.state',['received','needs_clarification']]},then:'proposals'},
  {case:{$or:[{$ne:[{$ifNull:['$lastLinkIssuedAt',null]},null]},{$ne:['$delivery.state','not_sent']}]},then:'waiting'}
 ],default:'contact'}}}},{$match:{...(q.q?{$or:[{'institution.identification.name':pattern},{'recipient.email':pattern},{'recipient.name':pattern},{reference:pattern}]}:{}),...(q.delivery?{'delivery.state':q.delivery}:{})}},{$facet:{counts:[{$group:{_id:'$stage',count:{$sum:1}}}],rows:[...(q.stage==='all'?[]:[{$match:{stage:q.stage}}]),{$sort:{'institution.identification.name':1,'recipient.email':1,createdAt:-1,_id:-1}},{$skip:(q.page-1)*20},{$limit:20},{$project:{version:1,trashedAt:1,reference:1,church:1,recipient:1,lifecycle:1,stage:1,delivery:1,review:1,'response.state':1,createdAt:1,expiresAt:1,'institution.identification.name':1,'proposedRepresentatives.reviewState':1,'proposedRepresentatives.acceptanceState':1,'proposedRepresentatives.activationState':1}}],total:[...(q.stage==='all'?[]:[{$match:{stage:q.stage}}]),{$count:'value'}]}}];
 const [result]=await Invitation.aggregate(pipeline);res.set('Cache-Control','no-store').json({data:result.rows,counts:Object.fromEntries(result.counts.map(c=>[c._id,c.count])),total:result.total[0]?.value||0,page:q.page});
};

exports.trash=async(req,res)=>{
 const invitation=parse(id,req.params.id),version=expectedVersion(req),{restore}=parse(z.strictObject({restore:z.boolean().default(false)}),req.body);
 const data=await Invitation.db.transaction(async session=>{
  const row=await Invitation.findById(invitation).session(session),{HttpError}=require('../utils/errors');
  if(!row)throw new HttpError(404,'NOT_FOUND','Invitación no encontrada');
  if(row.version!==version)throw new HttpError(409,'VERSION_CONFLICT','La invitación cambió. Actualiza la bandeja.');
  if(!restore&&!['closed','revoked','expired'].includes(row.lifecycle))throw new HttpError(409,'CLOSE_REQUIRED','Cierra el ciclo antes de moverlo a la papelera.');
  row.trashedAt=restore?undefined:new Date();row.trashedBy=restore?undefined:req.user._id;row.version++;row.updatedBy=req.user._id;await row.save({session});
  await require('../models/church-outreach-event.model').create([{invitation:row._id,actor:req.user._id,action:restore?'restored':'trashed',invitationVersion:row.version,reason:restore?'Restaurado desde papelera; conserva su estado.':'Movido a papelera; historial conservado.'}],{session});return row;
 });res.set('Cache-Control','no-store').json({data});
};
