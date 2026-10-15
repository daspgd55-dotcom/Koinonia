const {Schema,model}=require('mongoose');
const schema=new Schema({
 church:{type:Schema.Types.ObjectId,ref:'Church',required:true},author:{type:Schema.Types.ObjectId,ref:'User',required:true},
 category:{type:String,enum:['long_term','new_member','youth','testimony']},
 title:{type:String,required:true,maxlength:120},body:{type:String,required:true,maxlength:3000},displayName:{type:String,required:true,maxlength:60},
 status:{type:String,enum:['pending','approved','rejected','withdrawn'],default:'pending'},reason:{type:String,maxlength:1000},
 reports:[{by:{type:Schema.Types.ObjectId,ref:'User'},reason:String,at:Date,status:{type:String,enum:['pending','resolved'],default:'pending'},resolvedBy:{type:Schema.Types.ObjectId,ref:'User'},resolvedAt:Date,resolution:String}],
 moderationLog:[{_id:false,status:String,reason:String,by:{type:Schema.Types.ObjectId,ref:'User'},at:Date}]
},{timestamps:true,strict:'throw',optimisticConcurrency:true});
schema.index({church:1,status:1,createdAt:-1});schema.index({author:1,church:1});schema.index({status:1,createdAt:1});
module.exports=model('Experience',schema);
