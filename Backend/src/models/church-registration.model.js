const {Schema,model}=require('mongoose');
const schema=new Schema({
 reference:{type:String,required:true,unique:true},
 church:{name:String,address:String,commune:String,city:String,website:String,socialLinks:[String],authorityContact:{name:String,role:String,email:String,phone:String,authorized:Boolean}},
 applicant:{name:String,email:String,relationship:String,confirmedAt:Date,userId:{type:Schema.Types.ObjectId,ref:'User'}},
 representatives:[{email:String,proposedSubrole:String,approvedSubrole:String,confirmationStatus:{type:String,default:'pending'},confirmedAt:Date,userId:{type:Schema.Types.ObjectId,ref:'User'},invitationStatus:{type:String,default:'not_sent'},assignedAt:Date,acceptanceConsent:{purpose:String,textVersion:String,acceptedAt:Date},noContact:{type:Boolean,default:false},delivery:String}],
 comments:String,source:{type:String,default:'public_registration_v2'},
 status:{type:String,enum:['received','pending_email','pending_review','contacted','approved','rejected','duplicate','closed'],default:'received'},
 version:{type:Number,default:0},
 confirmation:{hash:{type:String,select:false},expiresAt:Date,delivery:String},
 identityReview:{status:{type:String,default:'pending'},churchId:{type:Schema.Types.ObjectId,ref:'Church'},reason:String,reviewedBy:{type:Schema.Types.ObjectId,ref:'User'},reviewedAt:Date,targetVersion:Number,suggestedChurchId:{type:Schema.Types.ObjectId,ref:'Church'}},
 representationReview:{approved:Boolean,reason:String,reviewedBy:{type:Schema.Types.ObjectId,ref:'User'},reviewedAt:Date},
 approval:{churchId:{type:Schema.Types.ObjectId,ref:'Church'},mode:String,at:Date,by:{type:Schema.Types.ObjectId,ref:'User'},fields:[String]},duplicateOf:{type:Schema.Types.ObjectId,ref:'ChurchRegistrationRequest'},publicMessage:String,
 noContact:{type:Boolean,default:false},anonymizedAt:Date,archivedAt:Date,
 mailOutbox:{type:[new Schema({id:String,payload:String,expiresAt:Date,createdAt:Date},{_id:false})],select:false,default:undefined},
 consents:[{purpose:String,textVersion:String,acceptedAt:Date}],
 provenance:[{field:String,source:String,at:Date}],
 history:[{action:String,from:String,to:String,reason:String,actor:{type:Schema.Types.ObjectId,ref:'User'},at:Date}],
 privacyRequests:[{kind:String,requestedAt:Date,resolvedAt:Date,reason:String,resolution:String,actor:{type:Schema.Types.ObjectId,ref:'User'}}],
 retention:{policy:{type:String,default:'review_after_180_days_no_automatic_deletion'},reviewAt:Date}
},{timestamps:true,strict:'throw'});
schema.index({status:1,createdAt:-1});
schema.index({'confirmation.hash':1});
schema.index({'approval.churchId':1});
module.exports=model('ChurchRegistrationRequest',schema);
