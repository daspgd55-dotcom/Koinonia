const {Schema,model}=require('mongoose');
const schema=new Schema({event:{type:Schema.Types.ObjectId,ref:'Event',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},status:{type:String,enum:['interested','going','withdrawn'],required:true},since:{type:Date,required:true},readChanges:[Schema.Types.ObjectId]},{timestamps:true,strict:'throw'});
schema.index({event:1,user:1},{unique:true});schema.index({user:1,status:1,updatedAt:-1});
schema.index({event:1,status:1});
module.exports=model('EventParticipation',schema);
