const {Schema,model}=require('mongoose');
const schema=new Schema({
 a:{type:Schema.Types.ObjectId,ref:'User',required:true},b:{type:Schema.Types.ObjectId,ref:'User',required:true},
 requestReadAt:{type:Date,default:null},requestedBy:{type:Schema.Types.ObjectId,required:true},status:{type:String,enum:['pending','accepted','removed','rejected'],default:'pending'},
 blockedBy:{type:[Schema.Types.ObjectId],default:[]},revision:{type:Number,default:1},lastRequestAt:{type:Date,default:Date.now},
 sequence:{type:Number,default:0}
},{timestamps:true,strict:'throw'});
schema.index({a:1,b:1},{unique:true});schema.index({a:1,updatedAt:-1});schema.index({b:1,updatedAt:-1});
module.exports=model('Friendship',schema);
