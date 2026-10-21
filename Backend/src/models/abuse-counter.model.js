const {Schema,model}=require('mongoose');
const schema=new Schema({_id:String,bucket:Number,count:Number,expiresAt:Date,purgeAt:Date},{autoIndex:false,versionKey:false,bufferCommands:false});
schema.index({purgeAt:1},{expireAfterSeconds:0});
module.exports=model('AbuseCounter',schema);
