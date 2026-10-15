const {Schema,model}=require('mongoose');
const event=new Schema({audience:{type:String,enum:['visitor','staff'],required:true},kind:String,text:{type:String,maxlength:1000},at:{type:Date,default:Date.now},readBy:[{type:Schema.Types.ObjectId,ref:'User'}]});
const schema=new Schema({
 church:{type:Schema.Types.ObjectId,ref:'Church',required:true},visitor:{type:Schema.Types.ObjectId,ref:'User',required:true},churchName:String,visitorName:String,
 optionKey:{type:String,required:true},meeting:{type:String,required:true},day:String,time:String,address:String,frequencyNotes:String,startsAt:{type:Date,required:true},endsAt:{type:Date,required:true},timezone:{type:String,default:'UTC-03:00'},
 message:{type:String,maxlength:1000},requestReply:{type:Boolean,default:false},status:{type:String,enum:['sent','received','cancelled'],default:'sent'},active:{type:Boolean,default:true},cancelledBy:String,
 receivedByName:String,receivedAt:Date,scheduleHistory:[{meeting:String,startsAt:Date,endsAt:Date,optionKey:String,changedAt:Date}],
 attendance:{type:String,enum:['unknown','attended','missed','dismissed'],default:'unknown'},followupSent:{type:Boolean,default:false},staffReadBy:[{type:Schema.Types.ObjectId,ref:'User'}],events:[event]
},{timestamps:true,strict:'throw'});
schema.index({church:1,visitor:1,optionKey:1,startsAt:1},{unique:true,partialFilterExpression:{active:true}});
schema.index({visitor:1,startsAt:-1});schema.index({church:1,startsAt:1});
module.exports=model('Visit',schema);
