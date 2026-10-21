const {Types}=require('mongoose'),Event=require('../models/event.model'),View=require('../models/event-view.model'),svc=require('../services/event.service'),v=require('../validation/schemas'),{HttpError}=require('../utils/errors');
exports.record=async(req,res)=>{
 v.parse(v.z.strictObject({}),req.body||{});const id=new Types.ObjectId(v.parse(v.id,req.params.id)),[event]=await Event.aggregate([{$match:{_id:id}},...svc.publicStages()]);
 if(!event)throw new HttpError(404,'NOT_FOUND','Evento no disponible');
 try{await View.updateOne({event:id,user:req.user._id},{$setOnInsert:{at:new Date()}},{upsert:true});}catch(e){if(e.code!==11000)throw e;}
 res.set('Cache-Control','no-store').json({ok:true});
};
