const {Types}=require('mongoose'),Event=require('../models/event.model'),Participation=require('../models/event-participation.model'),svc=require('../services/event.service'),{managed}=require('./event.controller'),{HttpError}=require('../utils/errors'),v=require('../validation/schemas');
const oid=value=>new Types.ObjectId(v.parse(v.id,value));
async function visible(id){const [e]=await Event.aggregate([{$match:{_id:oid(id)}},...svc.publicStages()]);return e;}
const eligible=e=>e&&e.eventStatus!=='cancelled'&&e.startsAt&&new Date(e.startsAt)>new Date();
const flags=p=>({interested:['interested','both'].includes(p?.status),going:['going','both'].includes(p?.status)});
const respond=(res,data)=>res.set('Cache-Control','no-store').json({data});
exports.get=async(req,res)=>{const event=await visible(req.params.id);if(!event)throw new HttpError(404,'NOT_FOUND','Evento no disponible');const p=await Participation.findOne({event:event._id,user:req.user._id}).lean();respond(res,{...flags(p),status:p?.status==='withdrawn'?null:p?.status||null,canParticipate:!!eligible(event)});};
exports.set=async(req,res)=>{
 const {status,enabled=true}=v.parse(v.z.strictObject({status:v.z.enum(['interested','going','withdrawn']),enabled:v.z.boolean().optional()}),req.body),eventId=oid(req.params.id),filter={event:eventId,user:req.user._id};
 if(status==='withdrawn'){await Participation.updateOne(filter,{$set:{status}});return respond(res,{status:null,interested:false,going:false});}
 if(!enabled&&!await Participation.exists(filter))return respond(res,{status:null,interested:false,going:false});
 const event=await visible(req.params.id);if(enabled&&!eligible(event))throw new HttpError(409,'PARTICIPATION_CLOSED','Solo puedes participar en eventos públicos que aún no comienzan y no están cancelados.');
 if(enabled&&status==='going'&&event.participation==='registration')throw new HttpError(409,'REGISTRATION_REQUIRED','Este evento requiere inscripción. Puedes marcar Me interesa y consultar las instrucciones del organizador.');
 const now=new Date(),interest=status==='interested'?enabled:{$in:['$status',['interested','both']]},going=status==='going'?enabled:{$in:['$status',['going','both']]},nextStatus={$cond:[interest,{$cond:[going,'both','interested']},{$cond:[going,'going','withdrawn']}]};
 // Cambios atómicos independientes: activar una opción conserva la otra y las lecturas.
 const pipeline=[{$set:{event:eventId,user:req.user._id,status:nextStatus,since:{$cond:[{$or:[{$eq:['$status','withdrawn']},{$eq:[{$ifNull:['$since',null]},null]}]},now,'$since']},createdAt:{$ifNull:['$createdAt',now]},updatedAt:now,readChanges:{$ifNull:['$readChanges',[]]}}}];
 try{await Participation.findOneAndUpdate(filter,pipeline,{upsert:true,updatePipeline:true,timestamps:false});}catch(e){if(e.code!==11000)throw e;await Participation.findOneAndUpdate(filter,pipeline,{updatePipeline:true,timestamps:false});}
 const current=await visible(req.params.id);if(enabled&&(!eligible(current)||(status==='going'&&current.participation==='registration'))){await Participation.updateOne({...filter,updatedAt:now},{$set:{status:'withdrawn'}});throw new HttpError(409,'PARTICIPATION_CLOSED','El evento dejó de estar disponible para participar.');}
 const saved=await Participation.findOne(filter).lean();respond(res,{status:saved?.status==='withdrawn'?null:saved?.status,...flags(saved)});
};
exports.counts=async(req,res)=>{const {event}=await managed(req),rows=await Participation.aggregate([{$match:{event:event._id,status:{$ne:'withdrawn'}}},{$group:{_id:'$status',count:{$sum:1}}}]);respond(res,{interested:rows.filter(r=>['interested','both'].includes(r._id)).reduce((n,r)=>n+r.count,0),going:rows.filter(r=>['going','both'].includes(r._id)).reduce((n,r)=>n+r.count,0)});};
exports.mine=async(req,res)=>{
 const q=v.parse(v.z.strictObject({view:v.z.enum(['upcoming','history']).default('upcoming'),page:v.z.coerce.number().int().min(1).max(10000).default(1),limit:v.z.coerce.number().int().min(1).max(50).default(20)}),req.query),now=new Date();
 const [result]=await Participation.aggregate([{$match:{user:req.user._id,status:{$ne:'withdrawn'}}},{$lookup:{from:Event.collection.name,let:{id:'$event'},pipeline:[{$match:{$expr:{$eq:['$_id','$$id']}}},...svc.publicStages()],as:'publicEvent'}},{$set:{publicEvent:{$arrayElemAt:['$publicEvent',0]}}},{$set:{pending:{$and:[{$gt:['$publicEvent.startsAt',now]},{$eq:['$publicEvent.eventStatus','scheduled']}]}}},{$match:{pending:q.view==='upcoming'}},{$sort:{updatedAt:-1,_id:1}},{$facet:{data:[{$skip:(q.page-1)*q.limit},{$limit:q.limit}],total:[{$count:'value'}]}}]);
 res.set('Cache-Control','no-store').json({data:result.data.map(p=>({eventId:p.event,status:p.status,...flags(p),pending:p.pending,event:p.publicEvent?svc.publicData(p.publicEvent,p.publicEvent.parent,p.publicEvent.organizerDoc,now):null})),pagination:{...q,total:result.total[0]?.value||0}});
};
exports.read=async(req,res)=>{const changeId=oid(req.params.id),[event]=await Event.aggregate([{$match:{'participationChanges._id':changeId}},...svc.publicStages()]);if(!event)return false;const change=event.participationChanges.find(c=>String(c._id)===String(changeId));const result=await Participation.updateOne({event:event._id,user:req.user._id,status:{$ne:'withdrawn'},since:{$lte:change.at}},{$addToSet:{readChanges:changeId}});if(!result.matchedCount)return false;res.set('Cache-Control','no-store').json({ok:true});return true;};

exports.interestCount=async(req,res)=>{const event=await visible(req.params.id);if(!event)throw new HttpError(404,'NOT_FOUND','Evento no disponible');respond(res,{interested:await Participation.countDocuments({event:event._id,status:{$in:['interested','both']}})});};
