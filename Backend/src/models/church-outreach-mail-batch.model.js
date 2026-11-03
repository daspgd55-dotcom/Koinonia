const {Schema,model}=require('mongoose');
const schema=new Schema({
 queuedBy:{type:Schema.Types.ObjectId,ref:'User'},cancelledBy:{type:Schema.Types.ObjectId,ref:'User'},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},state:{type:String,enum:['prepared','queued','cancelled'],default:'prepared'},version:{type:Number,default:1},requestKey:{type:String,required:true,unique:true},requestHash:{type:String,required:true},digest:{type:String,required:true},expiresAt:{type:Date,required:true},queuedAt:Date,cancelledAt:Date,
 selections:[{_id:false,invitation:{type:Schema.Types.ObjectId,ref:'ChurchOutreachInvitation'},kind:{type:String,enum:['institutional','member']},email:String,reminder:Boolean}],
 preview:{type:Schema.Types.Mixed,required:true}
},{timestamps:true,strict:'throw',optimisticConcurrency:true});
schema.index({createdAt:-1});module.exports=model('ChurchOutreachMailBatch',schema);
