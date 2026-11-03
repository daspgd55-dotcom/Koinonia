const {Schema,model}=require('mongoose');
const schema=new Schema({
 batch:{type:Schema.Types.ObjectId,ref:'ChurchOutreachMailBatch',required:true},invitation:{type:Schema.Types.ObjectId,ref:'ChurchOutreachInvitation',required:true},member:{type:Schema.Types.ObjectId,ref:'ChurchOutreachMember'},church:{type:Schema.Types.ObjectId,ref:'Church',required:true},email:{type:String,required:true},kind:{type:String,enum:['institutional','member'],required:true},reminder:Boolean,sourceRevision:String,templateVersion:String,
 logicalKey:{type:String,required:true,unique:true},jobId:{type:String,required:true,unique:true},state:{type:String,enum:['queued','accepted','delivered','failed','bounced','complained','cancelled'],default:'queued'},providerId:String,attempts:{type:Number,default:0},acceptedAt:Date,deliveredAt:Date,stoppedAt:Date,source:String,
 mailOutbox:{type:[new Schema({id:String,payload:String,expiresAt:Date,createdAt:Date},{_id:false})],select:false,default:undefined}
},{timestamps:true,strict:'throw'});
schema.index({invitation:1,member:1,createdAt:-1});schema.index({church:1,email:1,state:1});
module.exports=model('ChurchOutreachMail',schema);
