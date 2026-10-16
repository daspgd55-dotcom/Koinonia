const participation=require('../services/event-participation.service');
const {Types}=require('mongoose'),Event=require('../models/event.model'),Church=require('../models/church.model');
const v=require('../validation/event'),{id,parse}=require('../validation/schemas'),svc=require('../services/event.service'),{HttpError}=require('../utils/errors');
const {expectedVersion}=require('../utils/resource-version');
const objectId=value=>new Types.ObjectId(parse(id,value)),notFound=()=>new HttpError(404,'NOT_FOUND','Evento no encontrado');
const clean=e=>{const {participationChanges,collaborations,...data}=e.toObject?e.toObject():e;return data;};
const reply=(res,e,status=200)=>res.status(status).set('Cache-Control','no-store').set('ETag','"'+e.version+'"').json({data:{...clean(e),displayStatus:svc.displayStatus(e)}});
async function managed(req){const event=await Event.findById(objectId(req.params.id)).lean();if(!event)throw notFound();const church=await svc.parent(req,event.churchId);return {event,church};}
exports.create=async(req,res)=>{const body=parse(v.create,req.body);await svc.parent(req,body.churchId);await svc.organizer(body.churchId,body.communityId);const data=await Event.create({...body,effectiveEndsAt:svc.effectiveEnd(body.startsAt,body.endsAt),createdBy:req.user._id,updatedBy:req.user._id});reply(res,data,201);};
exports.detail=async(req,res)=>{const {event}=await managed(req);reply(res,event);};
async function write(req,res,event,changes,version){const kind=participation.changeKind(event,changes),collaboration=require('./event-collaboration.controller').eventChanges(req,event,kind);const data=await Event.findOneAndUpdate({_id:event._id,version},{...(kind?{$push:{participationChanges:{version:version+1,at:new Date(),kind},...collaboration.push}}:{}),$set:{...changes,updatedBy:req.user._id},$inc:{version:1}},{returnDocument:'after',runValidators:true,...(collaboration.arrayFilters.length?{arrayFilters:collaboration.arrayFilters}:{})});if(!data)throw new HttpError(409,'STALE_VERSION','El evento cambió en otra sesión. Recarga antes de guardar.');reply(res,data);}
exports.update=async(req,res)=>{
 const raw=parse(v.patch,req.body),version=expectedVersion(req),{event,church}=await managed(req);
 const stored=Object.fromEntries(Object.keys(v.fields.shape).map(k=>[k,event[k]]));stored.communityId=stored.communityId?String(stored.communityId):null;
 for(const k of ['startsAt','endsAt']){stored[k]=stored[k]?.toISOString()||null;if(raw[k] instanceof Date)raw[k]=raw[k].toISOString();}
 const content=parse(v.content,{...stored,...raw}),community=await svc.organizer(event.churchId,content.communityId);
 // Cambiar un evento público no permite eludir la validación de publicación.
 if(event.publicationStatus==='published')svc.publishable(content,church,community);
 await write(req,res,event,{...content,effectiveEndsAt:svc.effectiveEnd(content.startsAt,content.endsAt)},version);
};
exports.publication=async(req,res)=>{const body=parse(v.publication,req.body),version=expectedVersion(req),{event,church}=await managed(req);if(body.publicationStatus==='published')svc.publishable(event,church,await svc.organizer(event.churchId,event.communityId));await write(req,res,event,body,version);};
exports.state=async(req,res)=>{const body=parse(v.state,req.body),version=expectedVersion(req),{event}=await managed(req);await write(req,res,event,{...body,cancellationReason:body.eventStatus==='scheduled'?'':body.cancellationReason},version);};
exports.get=async(req,res)=>{const [row]=await Event.aggregate([{$match:{_id:objectId(req.params.id)}},...svc.publicStages()]);if(!row)throw notFound();res.set('Cache-Control','no-store').json({data:svc.publicData(row,row.parent,row.organizerDoc,new Date())});};
const exact=value=>new RegExp('^'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i');
async function list(req,res,management){
 const q=parse(management?v.managedQuery:v.query,req.query),filter={},now=new Date();
 for(const k of ['churchId','communityId'])if(q[k])filter[k]=objectId(q[k]);
 if(management&&q.churchId)await svc.parent(req,q.churchId);
 if(q.q)filter.title=new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
 if(q.category)filter.category=q.category;if(q.commune)filter['location.commune']=exact(q.commune);if(q.audience)filter.audience=exact(q.audience);
 for(const k of ['publicationStatus','eventStatus'])if(q[k])filter[k]=q[k];
 if(q.view!=='all')filter.effectiveEndsAt=q.view==='past'?{$ne:null,$lte:now}:{$gt:now};
 if(q.dateFrom||q.dateTo){filter.startsAt={};if(q.dateFrom)filter.startsAt.$gte=new Date(q.dateFrom+'T00:00:00-03:00');if(q.dateTo)filter.startsAt.$lt=new Date(+new Date(q.dateTo+'T00:00:00-03:00')+86400000);}
 const stages=management?[{$lookup:{from:Church.collection.name,localField:'churchId',foreignField:'_id',as:'parent'}},{$unwind:'$parent'},...(req.user.role==='admin'?[]:[{$match:{'parent.representatives':req.user._id}}])]:svc.publicStages();
 const [result]=await Event.aggregate([{$match:filter},...stages,...(q.associatedChurchId?[{$match:{$or:[{churchId:objectId(q.associatedChurchId)},{'collaboratorDocs._id':objectId(q.associatedChurchId)}]}}]:[]),{$sort:{startsAt:q.view==='past'?-1:1,_id:1}},{$facet:{rows:[{$skip:(q.page-1)*q.limit},{$limit:q.limit}],total:[{$count:'value'}]}}]);
 const total=result.total[0]?.value||0,data=result.rows.map(({parent,organizerDoc,organizers,...e})=>management?{...clean(e),displayStatus:svc.displayStatus(e,now)}:svc.publicData(e,parent,organizerDoc,now));
 res.set('Cache-Control','no-store').json({data,pagination:{page:q.page,limit:q.limit,total,pages:Math.ceil(total/q.limit)}});
}
exports.list=(req,res)=>list(req,res,false);exports.manage=(req,res)=>list(req,res,true);

exports.managed=managed;
