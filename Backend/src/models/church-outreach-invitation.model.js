const {Schema,model}=require('mongoose');
const ref=(name,extra={})=>({type:Schema.Types.ObjectId,ref:name,...extra}),embedded=fields=>new Schema(fields,{_id:false,strict:'throw'});
const schema=new Schema({
 reference:{type:String,required:true,unique:true,immutable:true},
 church:ref('Church',{required:true,immutable:true}),
 recipient:{email:{type:String,required:true,trim:true,lowercase:true,immutable:true,maxlength:254},name:{type:String,trim:true,maxlength:100}},
 contactKey:{type:String,required:true,immutable:true},
 contactSource:{
  kind:{type:String,required:true,enum:['institutional_website','institutional_social','direct_contact','administrative_record']},
  url:{type:String,maxlength:500},collectedAt:{type:Date,required:true},
  evidence:{type:String,required:true,maxlength:2000},recordedBy:ref('User',{required:true})
 },
 purpose:{type:String,enum:['church_profile_enrichment'],default:function(){return this.isNew?'church_profile_enrichment':undefined;},immutable:true},
 createdBy:ref('User',{required:true,immutable:true}),updatedBy:ref('User'),
 lifecycle:{type:String,enum:['draft','ready','expired','revoked','closed'],default:'draft'},
 active:{type:Boolean,default:true},version:{type:Number,default:1,min:1},
 lastMail:{type:Schema.Types.ObjectId,ref:'ChurchOutreachMail'},
 lastLinkIssuedAt:Date,
 expiresAt:{type:Date,required:true},revokedAt:Date,revokedBy:ref('User'),revocationReason:{type:String,maxlength:2000},closedAt:Date,
 delivery:embedded({state:{type:String,enum:['not_sent','queued','accepted','delivered','failed','bounced','cancelled'],default:'not_sent'},updatedAt:Date,providerId:String,attempts:{type:Number,default:0}}),
 response:embedded({state:{type:String,enum:['awaiting_response','received','needs_clarification','approved','rejected','declined','wrong_church','wrong_contact','closed'],default:'awaiting_response'},submittedAt:Date,respondent:embedded({name:String,email:String,relationship:String,user:ref('User')}),comments:{type:String,maxlength:3000}}),
 review:embedded({state:{type:String,enum:['pending','clarification','partial','approved','rejected'],default:'pending'},reason:String,at:Date,by:ref('User')}),
 communications:{type:[embedded({kind:{type:String,enum:['clarification']},text:String,state:{type:String,enum:['prepared'],default:'prepared'},at:Date,by:ref('User')})],default:[]},
 consent:embedded({acceptedAt:Date,revision:String,termsVersion:String,privacyVersion:String,termsText:String,privacyText:String,authorized:Boolean,communications:Boolean,advertising:{type:Boolean,default:false},purpose:String}),
 respondentParticipates:Boolean,
 proposedRepresentatives:{type:[embedded({name:{type:String,maxlength:100},email:{type:String,required:true,lowercase:true,trim:true,maxlength:254},proposedSubrole:{type:String,required:true,enum:['administrator','editor','moderator','welcome']},reviewState:{type:String,enum:['pending','approved','rejected'],default:'pending'},approvedSubrole:{type:String,enum:['administrator','editor','moderator','welcome']},reviewReason:String,reviewedAt:Date,reviewedBy:ref('User'),acceptanceState:{type:String,enum:['not_requested','pending','accepted','declined','revoked','expired'],default:'not_requested'},activationState:{type:String,enum:['not_started','pending','active','blocked'],default:'not_started'},user:ref('User')})],default:[]},
 targetReview:embedded({state:{type:String,enum:['pending','confirmed'],default:'pending'},fingerprint:String,churchVersion:Number,name:String,active:Boolean,teamSize:Number,reviewedBy:ref('User'),reviewedAt:Date,reason:{type:String,maxlength:2000}}),
 noContact:embedded({requested:{type:Boolean,default:false},at:Date,recordedBy:ref('User'),reason:{type:String,maxlength:2000}}),
 note:{type:String,maxlength:2000}
},{timestamps:true,strict:'throw',optimisticConcurrency:true});
schema.index({church:1,'recipient.email':1},{unique:true,partialFilterExpression:{active:true}});
schema.index({lifecycle:1,createdAt:-1});schema.index({expiresAt:1,active:1});
schema.pre('validate',function(){
 this.active=['draft','ready'].includes(this.lifecycle);
 if(this.noContact?.requested&&this.active)this.invalidate('lifecycle','Una invitación sin permiso de contacto debe estar cerrada o revocada');
 const emails=this.proposedRepresentatives.map(p=>p.email);if(new Set(emails).size!==emails.length)this.invalidate('proposedRepresentatives','No repitas representantes');
 if(emails.length>20)this.invalidate('proposedRepresentatives','Máximo 20 representantes');
});
module.exports=model('ChurchOutreachInvitation',schema);
