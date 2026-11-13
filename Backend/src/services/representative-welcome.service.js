const User=require('../models/user.model'),Church=require('../models/church.model'),Member=require('../models/church-outreach-member.model'),Registration=require('../models/church-registration.model'),Welcome=require('../models/representative-welcome.model'),Friend=require('../models/friendship.model'),Message=require('../models/message.model');
const text='¡Saludos y bendiciones! Bienvenido al equipo de administración de tu iglesia en Koinonía. Soy David, administrador de Koinonia. Puedes responder aquí en este chat para solicitar apoyo, resolver dudas o compartir dificultades al completar la ficha, abordaré cualquier problema que puedas comunicarme cuando esté disponible.';
async function welcome(user,churchId){
 if(user.role!=='representative')return {status:'not_eligible'};
 try{return await Welcome.db.transaction(async session=>{
  const previous=await Welcome.findById(user._id).session(session);if(previous)return {status:previous.status};
  const church=await Church.findOne({_id:churchId,active:true,representatives:user._id}).session(session);
  if(!church||require('./church-permissions').subrole(church,user)!=='administrator')return {status:'not_eligible'};
  const invitation=await Member.exists({church:church._id,acceptedBy:user._id,state:'accepted',acceptedSubrole:'administrator'}).session(session);
  const registration=invitation?null:await Registration.exists({'approval.churchId':church._id,status:'approved',representatives:{$elemMatch:{userId:user._id,invitationStatus:'accepted',approvedSubrole:'administrator'}}}).session(session);
  if(!invitation&&!registration)return {status:'not_eligible'};
  const sender=await User.findOne({username:'koinonia_admin',email:'koinoniapp@gmail.com',role:'admin',active:true,invitationPending:{$ne:true}}).session(session);
  if(!sender||String(sender._id)===String(user._id))return {status:'unavailable'};
  const [a,b]=[sender._id,user._id].sort((x,y)=>String(x).localeCompare(String(y)));let friend=await Friend.findOne({a,b}).session(session);
  if(friend&&(friend.blockedBy.length||['removed','rejected'].includes(friend.status))){await Welcome.create([{_id:user._id,church:church._id,sender:sender._id,status:'skipped',reason:'relationship_declined_or_blocked'}],{session});return {status:'skipped'};}
  if(!friend)[friend]=await Friend.create([{a,b,requestedBy:sender._id,status:'accepted',requestReadAt:new Date()}],{session});
  const gate=await Friend.findOneAndUpdate({_id:friend._id,revision:friend.revision,'blockedBy.0':{$exists:false},status:{$in:['pending','accepted']}},{$set:{status:'accepted',requestReadAt:new Date()},$inc:{sequence:1,revision:1}},{session,returnDocument:'after'});
  if(!gate)throw Error('WELCOME_RELATIONSHIP_CHANGED');
  await Welcome.create([{_id:user._id,church:church._id,sender:sender._id,friendship:gate._id,status:'sent'}],{session});
  await Message.create([{friendship:gate._id,sender:sender._id,recipient:user._id,sequence:gate.sequence,clientId:'representative-welcome:'+user._id,text}],{session});
  return {status:'sent',created:true};
 });}catch(e){if(e.code===11000){const previous=await Welcome.findById(user._id);if(previous)return {status:previous.status};}throw e;}
}
module.exports={welcome};
