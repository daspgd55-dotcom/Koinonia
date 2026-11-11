const {z,id,parse}=require('../validation/schemas'),svc=require('../services/church-make-queue.service'),Message=require('../models/church-make-message.model'),{quota,hash}=require('../services/account-security.service');
exports.list=async(req,res)=>{
 const q=parse(z.object({page:z.coerce.number().int().min(1).default(1),kind:z.enum(['initial','renewal']).optional()}),req.query),filter=q.kind?{kind:q.kind}:{};
 const [data,total]=await Promise.all([Message.find(filter).select('invitation kind state createdAt expiresAt reservedUntil resultAt reason providerId').populate({path:'invitation',select:'recipient.email church',populate:{path:'church',select:'identification.name'}}).sort({createdAt:-1,_id:-1}).skip((q.page-1)*20).limit(20).lean(),Message.countDocuments(filter)]);
 res.set('Cache-Control','no-store').json({data,total,page:q.page});
};
exports.prepare=async(req,res)=>{parse(z.strictObject({}),req.body);const m=await svc.prepare(parse(id,req.params.id),req.app.locals.config);res.set('Cache-Control','no-store').json({id:m._id,state:m.state,expiresAt:m.expiresAt});};
exports.renew=async(req,res)=>{const {token}=parse(z.strictObject({token:z.string().max(256)}),req.body),cfg=req.app.locals.config;await quota(cfg,'make-renew-ip',req.ip,10,3600000);await quota(cfg,'make-renew-token',hash(token),3,86400000);res.set('Cache-Control','no-store').json(await svc.renew(token));};

exports.sync=async(req,res)=>{parse(z.strictObject({}),req.body);const rows=await require('../models/church-outreach-invitation.model').find({initialChannel:'make',lifecycle:'ready','response.state':'awaiting_response','delivery.state':'not_sent'}).select('_id');for(const r of rows)await Message.updateOne({key:'initial:'+r.id},{$setOnInsert:{invitation:r._id,kind:'initial',state:'pending'}},{upsert:true});res.set('Cache-Control','no-store').json({count:rows.length});};
