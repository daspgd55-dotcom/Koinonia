const {Schema,model}=require('mongoose');
const schema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true},church:{type:Schema.Types.ObjectId,ref:'Church',required:true},active:{type:Boolean,default:true},since:{type:Date,required:true},readNotices:[Schema.Types.ObjectId]},{timestamps:true,strict:'throw'});
schema.index({user:1,church:1},{unique:true});schema.index({church:1,active:1});
module.exports=model('ChurchFollow',schema);
