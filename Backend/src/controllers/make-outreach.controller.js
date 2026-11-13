const {timingSafeEqual}=require('node:crypto'),{hash,quota}=require('../services/account-security.service'),{HttpError}=require('../utils/errors'),{z,id,parse}=require('../validation/schemas'),svc=require('../services/make-outreach.service');
exports.auth=async(req,res,next)=>{res.set('Cache-Control','no-store');const cfg=req.app.locals.config,key=cfg.makeOutreach?.keyHash,raw=req.get('X-Make-Key')||'';if(!cfg.makeOutreach?.enabled||!key||raw.length>256||!timingSafeEqual(Buffer.from(hash(raw)),Buffer.from(key)))throw new HttpError(401,'UNAUTHORIZED','Integración no disponible');await quota(cfg,'make-outreach',key,1000,3600000);next();};
const reservation={dispatchId:id,reservationToken:z.string().regex(/^[a-f0-9]{64}$/)};
exports.claim=async(req,res)=>{parse(z.strictObject({}),req.body);res.json(await svc.claim(req.app.locals.config));};
exports.claimMembers=async(req,res)=>{parse(z.strictObject({}),req.body);res.json(await svc.claimMembers(req.app.locals.config));};
exports.check=async(req,res)=>res.json(await svc.check(parse(z.strictObject(reservation),req.body)));
exports.result=async(req,res)=>res.json(await svc.result(parse(z.strictObject({...reservation,status:z.enum(['accepted','failed','uncertain']),providerId:z.string().trim().min(1).max(300).optional()}).refine(v=>v.status!=='accepted'||!!v.providerId,'Falta identificador de Gmail'),req.body)));
