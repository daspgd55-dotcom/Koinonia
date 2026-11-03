const {Schema,model}=require('mongoose');
module.exports=model('ChurchOutreachTeamLock',new Schema({_id:{type:Schema.Types.ObjectId,ref:'Church'},version:{type:Number,default:0}},{versionKey:false,strict:'throw'}));
