const {Schema,model}=require('mongoose');
const Lock=model('MaintenanceLock',new Schema({_id:String,owner:String,leaseUntil:Date},{versionKey:false}));
const runSchema=new Schema({_id:String,mode:String,state:String,startedAt:Date,finishedAt:Date,counts:Schema.Types.Mixed,batch:{type:Schema.Types.Mixed},reason:String,purgeAt:Date},{versionKey:false});
runSchema.index({purgeAt:1},{expireAfterSeconds:0});const Run=model('MaintenanceRun',runSchema);
module.exports={Lock,Run};
