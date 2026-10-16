const {Schema,model}=require('mongoose'),Church=require('./church.model');
const {categories,publicationStatuses,eventStatuses}=require('../validation/event');
const embedded=fields=>new Schema(fields,{_id:false,strict:'throw'});
const schema=new Schema({
 churchId:{type:Schema.Types.ObjectId,ref:'Church',required:true,immutable:true},communityId:{type:Schema.Types.ObjectId,ref:'LinkedCommunity',default:null},
 title:{type:String,required:true,trim:true,maxlength:200},description:{type:String,default:'',maxlength:10000},category:{type:String,enum:categories,default:'other'},
 startsAt:{type:Date,default:null},endsAt:{type:Date,default:null},effectiveEndsAt:{type:Date,default:null},
 modality:{type:String,enum:['in_person','online','hybrid'],default:'in_person'},venue:{type:String,default:null},
 location:{type:embedded({address:String,commune:{type:String,required:true},city:String,region:String,countryCode:String,coordinates:{type:Church.schema.path('location.coordinates').schema,default:undefined}}),default:null},onlineUrl:{type:String,default:null},
 audience:[String],cover:{type:embedded({url:{type:String,required:true},source:{type:String,required:true},title:String,frame:{type:String,enum:['landscape','wide','square','circle','portrait']},focalX:{type:Number,min:0,max:100},focalY:{type:Number,min:0,max:100}}),default:null},
 participation:{type:String,enum:['free','registration','invitation'],default:'free'},participationConditions:{type:String,default:''},registrationInstructions:{type:String,default:''},registrationUrl:{type:String,default:null},
 contact:{website:String,instagram:String,facebook:String,youtube:String,email:String,phone:String},privateFields:{email:{type:Boolean,default:false},phone:{type:Boolean,default:false}},
 publicationStatus:{type:String,enum:publicationStatuses,default:'draft'},eventStatus:{type:String,enum:eventStatuses,default:'scheduled'},cancellationReason:{type:String,default:''},
 participationChanges:[{version:{type:Number,required:true},at:{type:Date,required:true},kind:{type:String,enum:['changed','cancelled','rescheduled'],required:true}}],
 version:{type:Number,default:1},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},updatedBy:{type:Schema.Types.ObjectId,ref:'User',required:true}
},{timestamps:true,strict:'throw',optimisticConcurrency:true});
schema.index({churchId:1,publicationStatus:1,startsAt:1});schema.index({communityId:1,publicationStatus:1,startsAt:1});schema.index({publicationStatus:1,effectiveEndsAt:1});schema.index({publicationStatus:1,category:1,'location.commune':1,startsAt:1});
module.exports=model('Event',schema);
