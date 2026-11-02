const {Schema,model}=require('mongoose');
const schema=new Schema({request:{type:Schema.Types.ObjectId,ref:'ChurchRegistrationRequest',required:true},action:{type:String,required:true},actor:{type:Schema.Types.ObjectId,ref:'User'},at:{type:Date,default:Date.now},from:String,to:String,reason:String,fields:[String],publicMessage:String},{strict:'throw'});
schema.index({request:1,at:-1});module.exports=model('ChurchRegistrationEvent',schema);
