const {Schema,model}=require('mongoose');
const schema=new Schema({
 friendship:{type:Schema.Types.ObjectId,required:true},sender:{type:Schema.Types.ObjectId,required:true},recipient:{type:Schema.Types.ObjectId,required:true},
 readAt:{type:Date,default:null},clientId:{type:String,required:true},sequence:{type:Number,required:true},text:{type:String,maxlength:2000,default:''},
 resource:{type:new Schema({type:{type:String,enum:['church','event'],required:true},id:{type:Schema.Types.ObjectId,required:true}},{_id:false}),default:undefined}
},{timestamps:true,strict:'throw'});
schema.index({sender:1,clientId:1},{unique:true});schema.index({friendship:1,sequence:1},{unique:true});schema.index({recipient:1,friendship:1,sequence:1});schema.index({recipient:1,readAt:1});
module.exports=model('Message',schema);
