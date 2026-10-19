const {Schema,model}=require('mongoose');
const schema=new Schema({_id:String,count:{type:Number,default:0},expiresAt:{type:Date,required:true}},{versionKey:false});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=model('SecurityLimit',schema);
