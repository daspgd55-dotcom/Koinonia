const {Schema,model}=require('mongoose');
const schema=new Schema({event:{type:Schema.Types.ObjectId,ref:'Event',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},at:{type:Date,default:Date.now}},{strict:'throw',versionKey:false});
schema.index({event:1,user:1},{unique:true});
module.exports=model('EventView',schema);
