const {Schema,model}=require('mongoose');
const schema=new Schema({
 invitation:{type:Schema.Types.ObjectId,ref:'ChurchOutreachInvitation',required:true,immutable:true},
 tokenHash:{type:String,required:true,unique:true,select:false,immutable:true},
 purpose:{type:String,enum:['institutional_link','institutional_session'],required:true,immutable:true},
 expiresAt:{type:Date,required:true},consumedAt:Date,revokedAt:Date
},{timestamps:true,strict:'throw'});
schema.index({invitation:1,revokedAt:1});
module.exports=model('ChurchOutreachAccess',schema);
