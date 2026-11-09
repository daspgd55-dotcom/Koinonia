const {Schema,model}=require('mongoose');
const schema=new Schema({
 requestHash:{type:String,required:true,unique:true},source:{type:String,required:true},previewDigest:{type:String,required:true},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},
 resolution:{mode:String,before:Schema.Types.Mixed,fields:[String]},
 associations:[{sourceRow:Number,church:{type:Schema.Types.ObjectId,ref:'Church',required:true},name:String,contacts:{email:String,phone:String,website:String,facebook:String,instagram:String,youtube:String},recipients:[String],invalidEmails:[String],comparison:[{field:String,incoming:String,existing:String,state:String}],testData:Boolean}]
},{timestamps:true,strict:'throw'});
module.exports=model('ChurchContactImport',schema);
