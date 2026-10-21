const bcrypt=require('bcryptjs'),OTPAuth=require('otpauth'),QR=require('qrcode'),User=require('../models/user.model'),Mfa=require('../models/mfa.model'),m=require('../services/mfa.service'),security=require('../services/account-security.service'),v=require('../validation/schemas'),{HttpError}=require('../utils/errors');
const password=v.z.string().min(1).max(200),code=v.z.string().trim().min(1).max(64);
const select='+secret +pendingSecret +recoveryHashes +challengeHash';
async function owner(req){await security.quota(req.app.locals.config,'mfa-account',req.user.id,10,900000);const user=await User.findById(req.user.id).select('+password +sessionVersion');if(!user?.active)throw m.invalid();return user;}
async function reauth(user,value){if(!await bcrypt.compare(value,user.password))throw new HttpError(401,'INVALID_CREDENTIALS','Contraseña actual incorrecta.');}
exports.status=async(req,res)=>{const row=await Mfa.findOne({user:req.user.id}).select('+recoveryHashes');res.json({enabled:!!row?.active,configured:!!req.app.locals.config.mfa,recoveryRemaining:row?.active?row.recoveryHashes.length:0,required:!!req.app.locals.config.securityPolicy.adminMfaRequired});};
exports.setup=async(req,res)=>{
 const data=v.parse(v.z.strictObject({currentPassword:password}),req.body),user=await owner(req);await reauth(user,data.currentPassword);m.ready(req.app.locals.config);
 const secret=new OTPAuth.Secret({size:20}).base32,uri=m.totp(secret,user.email).toString(),encrypted=m.seal(secret,user.id,req.app.locals.config),qr=await QR.toDataURL(uri);
 try{const row=await Mfa.findOneAndUpdate({user:user._id,active:false},{$set:{pendingSecret:encrypted,pendingUntil:new Date(Date.now()+600000),pendingSession:user.sessionVersion||0},$inc:{revision:1},$push:m.audit('setup',user._id)},{upsert:true,returnDocument:'after'});if(!row)throw m.invalid();}catch(e){if(e.code===11000)throw new HttpError(409,'MFA_ALREADY_ENABLED','El segundo factor ya está activado.');throw e;}
 res.json({secret,qr,expiresIn:600});
};
exports.confirm=async(req,res)=>{
 const data=v.parse(v.z.strictObject({code}),req.body),user=await owner(req),row=await Mfa.findOne({user:user._id}).select(select);
 if(!row||row.active||!row.pendingUntil||row.pendingUntil<=new Date()||row.pendingSession!==(user.sessionVersion||0))throw m.invalid();
 const counter=m.step(m.unseal(row.pendingSecret,user.id,req.app.locals.config),data.code);if(counter===null)throw m.invalid();const codes=m.recovery();
 const result=await Mfa.updateOne({_id:row._id,revision:row.revision,active:false,pendingUntil:{$gt:new Date()}},{$set:{active:true,secret:row.pendingSecret,lastStep:counter,recoveryHashes:codes.map(security.hash)},$unset:{pendingSecret:1,pendingUntil:1,pendingSession:1,challengeHash:1},$inc:{revision:1},$push:m.audit('enabled',user._id)});
 if(!result.modifiedCount)throw m.invalid();await User.updateOne({_id:user._id},{$inc:{sessionVersion:1}});res.json({recoveryCodes:codes,reauthenticationRequired:true});
};
exports.login=async(req,res)=>{
 const data=v.parse(v.z.strictObject({challenge:v.z.string().regex(/^[a-f0-9]{64}$/),code}),req.body),cfg=req.app.locals.config;
 await security.quota(cfg,'mfa-challenge',data.challenge,5,300000);
 const row=await Mfa.findOne({challengeHash:security.hash(data.challenge),active:true,challengeUntil:{$gt:new Date()}}).select(select);if(!row)throw m.invalid();
 await security.quota(cfg,'mfa-login-account',String(row.user),10,900000);
 const user=await User.findById(row.user).select('+sessionVersion');if(!user?.active||(user.sessionVersion||0)!==row.challengeSession||user.invitationPending||security.required(user,cfg))throw m.invalid();
 const p=await m.proof(row,data.code,cfg);
 const updated=await Mfa.updateOne({_id:row._id,revision:row.revision,active:true,challengeHash:row.challengeHash,challengeUntil:{$gt:new Date()},...p.filter},{...p.update,$unset:{challengeHash:1,challengeUntil:1,challengeSession:1},$push:m.audit('login',user._id)});
 if(!updated.modifiedCount)throw m.invalid();res.json(require('./auth.controller').session(user,cfg,true));
};
exports.manage=async(req,res)=>{
 const data=v.parse(v.z.strictObject({currentPassword:password,code,action:v.z.enum(['disable','regenerate'])}),req.body),cfg=req.app.locals.config,user=await owner(req);await reauth(user,data.currentPassword);
 if(data.action==='disable'&&cfg.securityPolicy.adminMfaRequired)throw new HttpError(409,'MFA_REQUIRED','La política administrativa exige mantener el segundo factor.');
 const row=await Mfa.findOne({user:user._id,active:true}).select(select);if(!row)throw m.invalid();const p=await m.proof(row,data.code,cfg),codes=data.action==='regenerate'?m.recovery():null;
 const update={...p.update,$inc:{revision:1},$push:m.audit(data.action,user._id),$unset:{challengeHash:1,challengeUntil:1,pendingSecret:1,pendingUntil:1}};
 if(codes){delete update.$pull;update.$set={...update.$set,recoveryHashes:codes.map(security.hash)};}else{delete update.$pull;update.$set={active:false,recoveryHashes:[]};update.$unset.secret=1;}
 const result=await Mfa.updateOne({_id:row._id,revision:row.revision,active:true,...p.filter},update);if(!result.modifiedCount)throw m.invalid();
 await User.updateOne({_id:user._id},{$inc:{sessionVersion:1}});res.json({...(codes?{recoveryCodes:codes}:{}),reauthenticationRequired:true});
};
