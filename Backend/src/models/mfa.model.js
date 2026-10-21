const {Schema,model}=require('mongoose');
const schema=new Schema({
 user:{type:Schema.Types.ObjectId,ref:'User',required:true,unique:true},
 active:{type:Boolean,default:false},revision:{type:Number,default:0},
 secret:{type:String,select:false},pendingSecret:{type:String,select:false},pendingUntil:Date,pendingSession:Number,
 lastStep:{type:Number,default:-1},recoveryHashes:{type:[String],select:false},
 challengeHash:{type:String,select:false},challengeUntil:Date,challengeSession:Number,
 history:[{action:String,at:Date,actor:Schema.Types.ObjectId}]
},{timestamps:true,strict:'throw'});
module.exports=model('Mfa',schema);
