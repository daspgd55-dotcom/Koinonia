const { randomBytes, createHash } = require('node:crypto'), bcrypt = require('bcryptjs');
const User = require('../models/user.model'), v = require('../validation/schemas');
const { HttpError } = require('../utils/errors');
const hash = token => createHash('sha256').update(token).digest('hex');
const password = v.register.shape.password;
exports.change = async (req,res) => {
  const data = v.parse(v.z.strictObject({ currentPassword: v.z.string().min(1).max(200), newPassword: password }), req.body);
  const user = await User.findById(req.user._id).select('+password');
  if (!await bcrypt.compare(data.currentPassword,user.password)) throw new HttpError(400,'WRONG_PASSWORD','La contraseña actual no es correcta.');
  if (data.currentPassword === data.newPassword) throw new HttpError(400,'SAME_PASSWORD','Elige una contraseña diferente.');
  const updated = await User.updateOne({_id:user._id,active:true,password:user.password},{$set:{password:await bcrypt.hash(data.newPassword,12)},$inc:{sessionVersion:1},$unset:{passwordReset:1}});
  if (!updated.modifiedCount) throw new HttpError(409,'PASSWORD_CHANGED','La contraseña cambió. Inicia sesión nuevamente.');
  res.set('Cache-Control','no-store').json({message:'Contraseña actualizada. Inicia sesión nuevamente en tus dispositivos.'});
};
exports.forgot = async (req,res) => {
  const {email} = v.parse(v.z.strictObject({email:v.register.shape.email}),req.body), config=req.app.locals.config;
  if (!config.mail) throw new HttpError(503,'MAIL_UNAVAILABLE','La recuperación por correo aún no está disponible. Contacta al administrador.');
  const token=randomBytes(32).toString('hex'), tokenHash=hash(token), now=new Date();
  const user=await User.findOneAndUpdate({email,active:true,$or:[{'passwordReset.requestedAt':{$lt:new Date(Date.now()-60000)}},{'passwordReset.requestedAt':{$exists:false}}]},{$set:{passwordReset:{hash:tokenHash,expiresAt:new Date(Date.now()+1800000),requestedAt:now}}},{returnDocument:'after'});
  if(user){
    const link=config.mail.appUrl+'/#/restablecer?token='+token;
    try { const r=await (req.app.locals.mailFetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.mail.key,'Content-Type':'application/json'},body:JSON.stringify({from:config.mail.from,to:[user.email],subject:'Restablecer contraseña de Koinonía',text:'Abre este enlace para elegir una nueva contraseña. Vence en 30 minutos y solo puede usarse una vez:\n'+link+'\nSi no lo solicitaste, ignora este correo.'}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('mail'); }
    catch { await User.updateOne({_id:user._id,'passwordReset.hash':tokenHash},{$unset:{passwordReset:1}});console.error('PASSWORD_MAIL_FAILED'); }
  }
  res.set('Cache-Control','no-store').json({message:'Si existe una cuenta activa con ese correo, recibirás un enlace. Revisa también spam y espera un minuto antes de repetir.'});
};
exports.reset = async (req,res) => {
  const {token,newPassword}=v.parse(v.z.strictObject({token:v.z.string().regex(/^[a-f0-9]{64}$/),newPassword:password}),req.body);
  const updated=await User.updateOne({active:true,'passwordReset.hash':hash(token),'passwordReset.expiresAt':{$gt:new Date()}},{$set:{password:await bcrypt.hash(newPassword,12)},$inc:{sessionVersion:1},$unset:{passwordReset:1}});
  if(!updated.modifiedCount)throw new HttpError(400,'INVALID_RESET','El enlace venció o ya fue utilizado. Solicita uno nuevo.');
  res.set('Cache-Control','no-store').json({message:'Contraseña restablecida. Ya puedes iniciar sesión.'});
};
