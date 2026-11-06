const {z,parse}=require('../validation/schemas'),svc=require('../services/church-contact-import.service'),Batch=require('../models/church-contact-import.model');
const text=z.string().trim().max(1000).default(''),row=z.strictObject({row:z.number().int().min(1),name:text,email:text,phone:text,website:text,facebook:text,instagram:text,youtube:text,commune:text,address:text});
const fields={source:z.string().trim().min(1).max(200),rows:z.array(row).min(1).max(500).refine(rows=>new Set(rows.map(r=>r.row)).size===rows.length,'No repitas números de fila')};
const preview=z.strictObject(fields),confirm=z.strictObject({...fields,digest:z.string().regex(/^[a-f0-9]{64}$/),selectedRows:z.array(z.number().int().min(1)).min(1).max(500).refine(v=>new Set(v).size===v.length)});
exports.preview=async(req,res)=>res.set('Cache-Control','no-store').json(await svc.preview(parse(preview,req.body)));
exports.confirm=async(req,res)=>{const batch=await svc.confirm(parse(confirm,req.body),req.user);res.set('Cache-Control','no-store').json({id:batch._id,count:batch.associations.length});};
exports.list=async(req,res)=>res.set('Cache-Control','no-store').json({data:await Batch.find().select('source createdAt associations.sourceRow associations.church associations.name associations.recipients associations.invalidEmails').sort({createdAt:-1}).limit(20).lean()});
