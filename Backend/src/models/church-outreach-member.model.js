const {Schema,model}=require('mongoose');
const schema=new Schema({
 invitation:{type:Schema.Types.ObjectId,ref:'ChurchOutreachInvitation',required:true,immutable:true},church:{type:Schema.Types.ObjectId,ref:'Church',required:true,immutable:true},email:{type:String,required:true,lowercase:true,trim:true,immutable:true},
 subrole:{type:String,required:true,enum:['administrator','editor','moderator','welcome']},changeExistingRole:{type:Boolean,default:false},expectedSubrole:String,expectedUser:{type:Schema.Types.ObjectId,ref:'User'},
 state:{type:String,enum:['prepared','pending','accepted','declined','revoked','expired'],default:'prepared'},active:{type:Boolean,default:true},version:{type:Number,default:1},
 lastMail:{type:Schema.Types.ObjectId,ref:'ChurchOutreachMail'},
 purpose:{type:String,enum:['church_team_acceptance'],default:function(){return this.isNew?'church_team_acceptance':undefined;},immutable:true},tokenHash:{type:String,select:false},issuedAt:Date,expiresAt:{type:Date,required:true},
 approvedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},approvedAt:Date,reason:String,acceptedBy:{type:Schema.Types.ObjectId,ref:'User'},acceptedAt:Date,declinedAt:Date,revokedAt:Date,acceptedSubrole:String
},{timestamps:true,strict:'throw',optimisticConcurrency:true});
schema.index({invitation:1,email:1},{unique:true});schema.index({church:1,email:1},{unique:true,partialFilterExpression:{active:true}});schema.index({tokenHash:1},{unique:true,partialFilterExpression:{tokenHash:{$type:'string'}}});
module.exports=model('ChurchOutreachMember',schema);
