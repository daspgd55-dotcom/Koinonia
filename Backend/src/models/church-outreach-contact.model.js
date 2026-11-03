const {Schema,model}=require('mongoose');
// Durable suppression and transactional lock for this church + normalized email.
const schema=new Schema({
 _id:String,church:{type:Schema.Types.ObjectId,ref:'Church',required:true,immutable:true},
 email:{type:String,required:true,immutable:true,lowercase:true,trim:true},
 deliveryBlocked:{type:Boolean,default:false},deliveryBlockReason:String,deliveryBlockedAt:Date,noContact:{type:Boolean,default:false},recordedAt:Date,recordedBy:{type:Schema.Types.ObjectId,ref:'User'},reason:{type:String,maxlength:2000},
 version:{type:Number,default:0}
},{timestamps:true,strict:'throw'});
schema.index({church:1,email:1},{unique:true});
module.exports=model('ChurchOutreachContact',schema);
