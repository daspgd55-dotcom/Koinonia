const {z,id,parse}=require('../validation/schemas'),svc=require('../services/church-make-queue.service'),Message=require('../models/church-make-message.model'),{quota,hash}=require('../services/account-security.service');
exports.list=async(req,res)=>{
 const q=parse(z.object({trash:z.enum(['true','false']).default('false'),page:z.coerce.number().int().min(1).default(1),kind:z.enum(['initial','renewal','member']).optional()}),req.query),filter={trashedAt:q.trash==='true'?{$ne:null}:null,...(q.kind?{kind:q.kind}:{}),invitation:{$nin:await require('../models/church-outreach-invitation.model').find({trashedAt:{$ne:null}}).distinct('_id')}};
 const [data,total]=await Promise.all([Message.find(filter).select('trashedAt invitation member kind state createdAt expiresAt reservedUntil resultAt reason providerId').populate({path:'invitation',select:'recipient.email church',populate:{path:'church',select:'identification.name'}}).populate({path:'member',select:'email subrole'}).sort({createdAt:-1,_id:-1}).skip((q.page-1)*20).limit(20).lean(),Message.countDocuments(filter)]);
 for(const m of data)m.canPrepare=m.kind!=='member'&&await svc.canPrepare({...m,invitation:m.invitation?._id});
 res.set('Cache-Control','no-store').json({data:data.map(m=>({...m,invitation:m.invitation?._id?.toString()||null,invitationDetails:m.invitation})),total,page:q.page});
};
exports.prepare=async(req,res)=>{parse(z.strictObject({}),req.body);const m=await svc.prepare(parse(id,req.params.id),req.app.locals.config);res.set('Cache-Control','no-store').json({id:m._id,state:m.state,expiresAt:m.expiresAt});};
exports.renew=async(req,res)=>{const {token}=parse(z.strictObject({token:z.string().max(256)}),req.body),cfg=req.app.locals.config;await quota(cfg,'make-renew-ip',req.ip,10,3600000);await quota(cfg,'make-renew-token',hash(token),3,86400000);res.set('Cache-Control','no-store').json(await svc.renew(token));};
exports.sync=async(req,res)=>{parse(z.strictObject({}),req.body);const rows=await require('../models/church-outreach-invitation.model').find({initialChannel:'make',lifecycle:'ready','response.state':'awaiting_response','delivery.state':'not_sent'}).select('_id');for(const r of rows)await Message.updateOne({key:'initial:'+r.id},{$setOnInsert:{invitation:r._id,kind:'initial',state:'pending'}},{upsert:true});res.set('Cache-Control','no-store').json({count:rows.length});};
exports.preparable=async(req,res)=>{
 const q=parse(z.object({kind:z.enum(['initial','renewal','member']).optional()}),req.query),rows=await Message.find({trashedAt:null,state:{$in:['pending','blocked','cancelled']},kind:{$ne:'member'},...(q.kind?{kind:q.kind}:{})}).select('_id invitation kind state createdAt').sort({createdAt:-1,_id:-1}).lean(),eligible=await svc.canPrepareMany(rows),ids=[],seen=new Set();
 for(const m of rows)if(!seen.has(String(m.invitation))&&eligible.get(String(m._id))){ids.push(m._id);seen.add(String(m.invitation));}
 res.set('Cache-Control','no-store').json({ids});
};
exports.trash=async(req,res)=>{
 const {restore}=parse(z.strictObject({restore:z.boolean().default(false)}),req.body),messageId=parse(id,req.params.id),{HttpError}=require('../utils/errors');
 await Message.db.transaction(async session=>{const m=await Message.findById(messageId).session(session);if(!m)throw new HttpError(404,'NOT_FOUND','Mensaje no encontrado');
 if(['reserved','uncertain'].includes(m.state))throw new HttpError(409,'DELIVERY_REVIEW_REQUIRED','Revisa primero el envío reservado o incierto en Gmail.');
 if(!restore){m.trashedAt=new Date();m.trashedBy=req.user._id;if(['pending','blocked','prepared'].includes(m.state)){m.state='cancelled';m.payload=undefined;m.reason='Descartado por el administrador';if(m.access)await require('../models/church-outreach-access.model').updateOne({_id:m.access},{$set:{revokedAt:new Date()}},{session});if(m.kind==='member'&&m.member)await require('../models/church-outreach-member.model').updateOne({_id:m.member,state:'pending'},{$set:{state:'revoked',active:false,revokedAt:new Date()},$unset:{tokenHash:1},$inc:{version:1}},{session});}}
 else{m.trashedAt=undefined;m.trashedBy=undefined;}await m.save({session});});res.set('Cache-Control','no-store').json({ok:true});
};
