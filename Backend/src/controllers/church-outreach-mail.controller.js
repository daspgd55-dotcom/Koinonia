const {z,id,parse}=require('../validation/schemas'),{expectedVersion}=require('../utils/resource-version'),Batch=require('../models/church-outreach-mail-batch.model'),Mail=require('../models/church-outreach-mail.model'),svc=require('../services/church-outreach-mail.service'),{HttpError}=require('../utils/errors');
const selection=z.discriminatedUnion('kind',[z.strictObject({invitation:id,kind:z.literal('institutional'),reminder:z.boolean().default(false)}),z.strictObject({invitation:id,kind:z.literal('member'),email:z.string().trim().toLowerCase().email().max(254),reminder:z.boolean().default(false)})]);
const input=z.strictObject({selections:z.array(selection).min(1).max(25).refine(rows=>new Set(rows.map(r=>r.invitation+':'+r.kind+':'+(r.email||''))).size===rows.length,'Selecciona cada destinatario una sola vez')});
const reply=(res,data)=>res.set('Cache-Control','no-store').json(data);
async function get(req){const row=await Batch.findById(parse(id,req.params.id));if(!row)throw new HttpError(404,'NOT_FOUND','Lote no encontrado');return row;}
exports.preview=async(req,res)=>reply(res,await svc.plans(parse(input,req.body).selections,req.app.locals.config));
exports.prepare=async(req,res)=>reply(res,{data:await svc.prepare(parse(input,req.body).selections,parse(z.string().uuid(),req.get('Idempotency-Key')),req.user,req.app.locals.config)});
exports.list=async(req,res)=>{const q=parse(z.strictObject({page:z.coerce.number().int().min(1).max(10000).default(1)}),req.query);const [data,total]=await Promise.all([Batch.find().select('-preview -requestHash -requestKey').sort({createdAt:-1,_id:-1}).skip((q.page-1)*20).limit(20),Batch.countDocuments()]);reply(res,{data,total,page:q.page,capabilities:svc.capabilities(req.app.locals.config)});};
exports.detail=async(req,res)=>{const row=await get(req),messages=await Mail.find({batch:row._id}).sort({createdAt:1}).lean();reply(res,{data:row,messages,capabilities:svc.capabilities(req.app.locals.config)});};
exports.simulate=async(req,res)=>{parse(z.strictObject({}),req.body);const row=await get(req);reply(res,{simulation:true,...await svc.plans(row.selections,req.app.locals.config),message:'Simulación sin emitir tokens, modificar invitaciones ni preparar trabajos de transporte.'});};
exports.enqueue=async(req,res)=>{parse(z.strictObject({confirm:z.literal(true)}),req.body);reply(res,{data:await svc.enqueue(parse(id,req.params.id),expectedVersion(req),req.user,req.app.locals.config,req.app.locals.mailFetch)});};
exports.cancel=async(req,res)=>{parse(z.strictObject({}),req.body);reply(res,{data:await svc.cancel(parse(id,req.params.id),expectedVersion(req),req.user)});};

exports.sendMembers=async(req,res)=>{
 const invitation=parse(id,req.params.id),cfg=req.app.locals.config;parse(z.strictObject({}),req.body);
 const members=await require('../models/church-outreach-member.model').find({invitation,active:true,state:{$in:['pending','prepared']}}).select('email');
 if(!members.length)throw new HttpError(409,'NO_PENDING_MEMBERS','No hay representantes aprobados pendientes de aceptación.');
 const preview=await svc.plans(members.map(m=>({invitation,kind:'member',email:m.email,reminder:false})),cfg);
 const selections=preview.items.filter(i=>i.eligible).map(i=>i.selection),excluded=preview.items.filter(i=>!i.eligible).map(i=>({email:i.email,reasons:i.reasons}));
 if(!selections.length)return reply(res,{processed:0,excluded});
 const batch=await svc.prepare(selections,require('node:crypto').randomUUID(),req.user,cfg);
 await svc.enqueue(batch.id,batch.version,req.user,cfg,req.app.locals.mailFetch);
 reply(res,{processed:selections.length,excluded,queued:svc.capabilities(cfg).queueEnabled});
};
