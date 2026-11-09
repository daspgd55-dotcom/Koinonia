const {z,id,parse}=require('../validation/schemas'),svc=require('../services/church-campaign.service');
const imports=z.array(id).min(1).max(100),keys=z.array(z.string().max(300)).min(1).max(500).refine(v=>new Set(v).size===v.length);
exports.preview=async(req,res)=>res.set('Cache-Control','no-store').json(await svc.preview(parse(z.strictObject({imports}),req.body).imports));
exports.prepare=async(req,res)=>res.set('Cache-Control','no-store').json(await svc.prepare(parse(z.strictObject({imports,keys,digest:z.string().length(64),reviewed:z.array(z.string().max(300)).max(500).default([])}),req.body),req.user));
