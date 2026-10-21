const {Schema,model}=require('mongoose');
const schema=new Schema({_id:String,providerId:{type:String,index:true},type:String,occurredAt:Date,source:{type:String,enum:['provider','simulated']},purgeAt:Date},{timestamps:true,versionKey:false});
schema.index({purgeAt:1},{expireAfterSeconds:0});
module.exports=model('MailEvent',schema);
