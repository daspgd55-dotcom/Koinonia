const {Schema,model}=require('mongoose');
const schema=new Schema({request:{type:Schema.Types.ObjectId,ref:'ChurchRegistrationRequest',required:true},participant:Schema.Types.ObjectId,email:String,kind:{type:String,enum:['confirm','access','session','invite'],required:true},hash:{type:String,required:true,select:false},expiresAt:{type:Date,required:true},createdAt:{type:Date,default:Date.now}},{strict:'throw'});
schema.index({hash:1},{unique:true});schema.index({expiresAt:1},{expireAfterSeconds:0});schema.index({request:1});module.exports=model('ChurchRegistrationAccess',schema);
