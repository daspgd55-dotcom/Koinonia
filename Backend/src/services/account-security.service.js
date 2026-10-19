const {randomBytes,createHash,createHmac}=require('node:crypto'),User=require('../models/user.model'),Limit=require('../models/security-limit.model'),{HttpError}=require('../utils/errors');
const hash=token=>createHash('sha256').update(token).digest('hex');
const enabled=config=>config.requireVerifiedEmail!==false;
const required=(user,config)=>enabled(config)&&!user.emailVerifiedAt&&(user.emailVerificationRequired||config.enforceLegacyVerification);
const message='Si corresponde, recibirás un enlace por correo. Revisa spam y espera un minuto antes de repetir.';
function mailReady(config){if(!config.mail)throw new HttpError(503,'MAIL_UNAVAILABLE','El envío de correos aún no está disponible. Inténtalo más tarde.');}
async function quota(config,scope,key,max,windowMs){
 const bucket=Math.floor(Date.now()/windowMs),id=createHmac('sha256',config.jwtSecret).update(scope+':'+key+':'+bucket).digest('hex');
 let row;try{row=await Limit.findOneAndUpdate({_id:id},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((bucket+2)*windowMs)}},{upsert:true,returnDocument:'after'});}catch(e){if(e.code!==11000)throw e;row=await Limit.findOneAndUpdate({_id:id},{$inc:{count:1}},{returnDocument:'after'});}
 if(row.count>max)throw new HttpError(429,'RATE_LIMIT','Has realizado varios intentos. Espera un momento antes de volver a intentarlo.');
}
async function send(req,email,subject,text){const config=req.app.locals.config;mailReady(config);await quota(config,'mail-global','all',100,3600000);const r=await(req.app.locals.mailFetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.mail.key,'Content-Type':'application/json'},body:JSON.stringify({from:config.mail.from,to:[email],subject,text}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('MAIL_DELIVERY_FAILED');}
async function issue(req,user,purpose){
 const cfg=req.app.locals.config;mailReady(cfg);const token=randomBytes(32).toString('hex'),digest=hash(token),now=new Date(),hours=purpose==='invite'?24:1;
 const updated=await User.findOneAndUpdate({_id:user._id,active:true,emailVerifiedAt:null,$or:[{'emailAction.requestedAt':{$lt:new Date(Date.now()-60000)}},{'emailAction.requestedAt':{$exists:false}}]},{$set:{emailAction:{hash:digest,purpose,expiresAt:new Date(Date.now()+hours*3600000),requestedAt:now,issuedBy:req.user?._id}}},{returnDocument:'after'});
 if(!updated)return false;
 const route=purpose==='invite'?'aceptar-invitacion':'verificar-correo',link=cfg.mail.appUrl+'/#/'+route+'?token='+token;
 try{await send(req,user.email,purpose==='invite'?'Invitación a representar una comunidad en Koinonía':'Verifica tu correo en Koinonía',`${purpose==='invite'?'Te han invitado como representante. Establece tu propia contraseña.':'Confirma tu correo introduciendo la contraseña de tu cuenta. Si no creaste esta cuenta, no la actives; puedes recuperar su acceso desde la página de recuperación.'}\nAbre este enlace de un solo uso; vence en ${hours} horas:\n${link}\nSi no esperabas este correo, puedes ignorarlo.`);return true;}
 catch{await User.updateOne({_id:user._id,'emailAction.hash':digest},{$unset:{'emailAction.hash':1,'emailAction.expiresAt':1}});console.error('ACCOUNT_MAIL_FAILED');return false;}
}
async function passwordNotice(req,email){if(!req.app.locals.config.mail)return;try{await send(req,email,'Tu contraseña de Koinonía cambió','Se cambió tu contraseña y se cerraron las sesiones anteriores. Si no reconoces este cambio, utiliza Recuperar contraseña desde Koinonía.');}catch{console.error('PASSWORD_NOTICE_FAILED');}}
module.exports={hash,enabled,required,message,mailReady,quota,send,issue,passwordNotice};
