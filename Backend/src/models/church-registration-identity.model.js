const {Schema,model}=require('mongoose');
// Serializes concurrent approvals of the same normalized new-church identity.
const schema=new Schema({_id:String,request:{type:Schema.Types.ObjectId,ref:'ChurchRegistrationRequest'},church:{type:Schema.Types.ObjectId,ref:'Church'},createdAt:{type:Date,default:Date.now}},{strict:'throw'});
module.exports=model('ChurchRegistrationIdentity',schema);
