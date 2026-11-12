const Invitation=require('../models/church-outreach-invitation.model'),Event=require('../models/church-outreach-event.model'),v=require('../validation/church-outreach'),{z,id,parse}=require('../validation/schemas'),{expectedVersion}=require('../utils/resource-version'),svc=require('../services/church-outreach.service');
const reply=(res,result,status=200)=>res.status(status).set('Cache-Control','no-store').set('ETag','"'+result.data.version+'"').json(result);
exports.create=async(req,res)=>{const row=await svc.create(parse(v.create,req.body),req.user);reply(res,await svc.detail(row._id),201);};
exports.detail=async(req,res)=>reply(res,await svc.detail(parse(id,req.params.id)));
exports.action=async(req,res)=>{const row=await svc.act(parse(id,req.params.id),expectedVersion(req),parse(v.action,req.body),req.user);reply(res,await svc.detail(row._id));};
exports.list=async(req,res)=>{
 const q=parse(v.list,req.query),filter={trashedAt:null,...(q.churchId?{church:q.churchId}:{})},now=new Date();
 if(q.lifecycle==='expired')filter.$or=[{lifecycle:'expired'},{lifecycle:{$in:['draft','ready']},expiresAt:{$lte:now}}];else if(q.lifecycle){filter.lifecycle=q.lifecycle;if(['draft','ready'].includes(q.lifecycle))filter.expiresAt={$gt:now};}
 const [rows,total]=await Promise.all([Invitation.find(filter).sort({createdAt:-1,_id:-1}).skip((q.page-1)*q.limit).limit(q.limit),Invitation.countDocuments(filter)]);
 res.set('Cache-Control','no-store').json({data:rows.map(row=>({...row.toObject(),effectiveLifecycle:['draft','ready'].includes(row.lifecycle)&&row.expiresAt<=now?'expired':row.lifecycle})),pagination:{page:q.page,limit:q.limit,total}});
};
exports.events=async(req,res)=>{const invitation=parse(id,req.params.id),q=parse(z.strictObject({page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(100).default(50)}),req.query);await svc.detail(invitation);const [data,total]=await Promise.all([Event.find({invitation}).sort({at:-1,_id:-1}).skip((q.page-1)*q.limit).limit(q.limit),Event.countDocuments({invitation})]);res.set('Cache-Control','no-store').json({data,pagination:{page:q.page,limit:q.limit,total}});};
