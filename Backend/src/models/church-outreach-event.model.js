const {Schema,model}=require('mongoose');
const schema=new Schema({
 invitation:{type:Schema.Types.ObjectId,ref:'ChurchOutreachInvitation',required:true,immutable:true},
 actor:{type:Schema.Types.ObjectId,ref:'User',immutable:true},
 actorType:{type:String,enum:['admin','recipient','member'],default:function(){return this.isNew?'admin':undefined;},required:true,immutable:true},
 action:{type:String,enum:['created','target_reviewed','expired','revoked','closed','no_contact_recorded','link_issued','access_started','response_recorded','clarification_requested','people_reviewed','proposal_rejected','member_link_issued','member_revoked','member_accepted','member_declined','mail_queued'],required:true,immutable:true},
 at:{type:Date,default:function(){return this.isNew?new Date():undefined;},immutable:true},from:String,to:String,reason:{type:String,maxlength:2000},
 commandKey:String,commandHash:String,memberEmail:String,
 decisions:[{_id:false,email:String,state:String,subrole:String,requestedSubrole:String,changeExistingRole:Boolean}],responseState:String,invitationVersion:{type:Number,required:true},churchVersion:Number
},{strict:'throw'});
schema.index({invitation:1,at:-1,_id:-1});schema.index({commandKey:1},{unique:true,partialFilterExpression:{commandKey:{$type:'string'}}});
module.exports=model('ChurchOutreachEvent',schema);
