const bcrypt=require('bcryptjs'),crypto=require('node:crypto'),User=require('../models/user.model'),v=require('../validation/schemas'),s=require('../services/account-security.service'),{HttpError}=require('../utils/errors');
const token=v.z.string().regex(/^[a-f0-9]{64}$/);
exports.resend=async(req,res)=>{
 const {email}=v.parse(v.z.strictObject({email:v.register.shape.email}),req.body),cfg=req.app.locals.config;s.mailReady(cfg);
 await s.quota(cfg,'mail-email',email,5,3600000);
 const user=await User.findOne({email,active:true,emailVerifiedAt:null});if(user)await s.issue(req,user,user.invitationPending?'invite':'verify');
 res.json({message:s.message});
};
exports.verify=async(req,res)=>{
 const data=v.parse(v.z.strictObject({token,password:v.login.shape.password}),req.body),digest=s.hash(data.token),cfg=req.app.locals.config;
 await s.quota(cfg,'verify-token',digest,8,3600000);
 const user=await User.findOne({active:true,'emailAction.hash':digest,'emailAction.purpose':'verify','emailAction.expiresAt':{$gt:new Date()}}).select('+password');
 if(!user||!await bcrypt.compare(data.password,user.password))throw new HttpError(400,'INVALID_VERIFICATION','El enlace o la contraseña no son válidos. Revisa los datos o solicita un nuevo enlace.');
 const r=await User.updateOne({_id:user._id,active:true,password:user.password,'emailAction.hash':digest,'emailAction.expiresAt':{$gt:new Date()}},{$set:{emailVerifiedAt:new Date()},$unset:{emailAction:1,passwordReset:1},$inc:{sessionVersion:1}});
 if(!r.modifiedCount)throw new HttpError(400,'INVALID_VERIFICATION','El enlace venció o ya fue utilizado.');res.json({message:'Correo verificado. Ya puedes iniciar sesión.'});
};
exports.accept=async(req,res)=>{
 const {token:raw,newPassword}=v.parse(v.z.strictObject({token,newPassword:v.password}),req.body),digest=s.hash(raw);
 const r=await User.updateOne({active:true,invitationPending:true,'emailAction.hash':digest,'emailAction.purpose':'invite','emailAction.expiresAt':{$gt:new Date()}},{$set:{password:await bcrypt.hash(newPassword,12),emailVerifiedAt:new Date(),invitationPending:false},$unset:{emailAction:1,passwordReset:1},$inc:{sessionVersion:1}});
 if(!r.modifiedCount)throw new HttpError(400,'INVALID_INVITATION','La invitación venció o ya fue utilizada. Solicita un nuevo enlace.');res.json({message:'Invitación aceptada. Ya puedes iniciar sesión con tu contraseña.'});
};
exports.invite=async(req,res)=>{
 const data=v.parse(v.z.strictObject({name:v.z.string().trim().min(1).max(100),email:v.register.shape.email,position:v.z.string().trim().min(1).max(200)}),req.body),cfg=req.app.locals.config;s.mailReady(cfg);
 await s.quota(cfg,'invite-admin',String(req.user._id),20,3600000);await s.quota(cfg,'mail-email',data.email,5,3600000);
 let user;try{user=await User.create({...data,password:await bcrypt.hash(crypto.randomBytes(32).toString('hex'),12),role:'representative',invitationPending:true,emailVerificationRequired:true,invitedBy:req.user._id,onboarding:{status:'skipped',version:3,lastStep:0}});}catch(e){if(e.code!==11000)throw e;throw new HttpError(409,'ACCOUNT_EXISTS','Esa cuenta ya existe. Utiliza la consulta de cuentas o reenvía su invitación.');}
 const sent=await s.issue(req,user,'invite');res.status(201).json({data:{_id:user.id,name:user.name,email:user.email,role:user.role,position:user.position,invitationPending:true},delivery:sent?'sent':'failed',message:sent?'Invitación enviada. El representante elegirá su contraseña.':'Cuenta pendiente creada; no se pudo enviar el correo. Puedes reenviar el enlace cuando el servicio esté disponible.'});
};
