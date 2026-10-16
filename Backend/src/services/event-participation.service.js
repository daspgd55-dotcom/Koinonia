const Event=require('../models/event.model'),Participation=require('../models/event-participation.model'),svc=require('./event.service');
function changeKind(event,changes){
 if(event.publicationStatus!=='published')return null;
 if(changes.eventStatus==='cancelled'&&event.eventStatus!=='cancelled')return 'cancelled';
 if(changes.eventStatus==='scheduled'&&event.eventStatus==='cancelled')return 'rescheduled';
 const next={...event,...changes},stable=v=>JSON.stringify(v??null),time=v=>v?new Date(v).toISOString():null,location=v=>v?{address:v.address||'',commune:v.commune||'',city:v.city||'',region:v.region||'',countryCode:v.countryCode||'',coordinates:v.coordinates?.coordinates||null}:null;
 return ['startsAt','endsAt'].some(k=>time(event[k])!==time(next[k]))||['venue','modality','onlineUrl'].some(k=>stable(event[k])!==stable(next[k]))||stable(location(event.location))!==stable(location(next.location))?'changed':null;
}
function notificationStages(user){return [
 ...svc.publicStages(),{$unwind:'$participationChanges'},
 {$lookup:{from:Participation.collection.name,let:{event:'$_id',at:'$participationChanges.at'},pipeline:[{$match:{$expr:{$and:[{$eq:['$event','$$event']},{$eq:['$user',user._id]},{$ne:['$status','withdrawn']},{$lte:['$since','$$at']}]}}}],as:'participation'}},{$unwind:'$participation'},
 {$project:{_id:'$participationChanges._id',eventId:'$_id',churchName:'$title',startsAt:1,source:{$literal:'event'},audience:{$literal:'participant'},at:'$participationChanges.at',kind:'$participationChanges.kind',read:{$in:['$participationChanges._id',{$ifNull:['$participation.readChanges',[]]}]},text:{$switch:{branches:[{case:{$eq:['$participationChanges.kind','cancelled']},then:'El evento fue cancelado. Consulta el aviso del organizador.'},{case:{$eq:['$participationChanges.kind','rescheduled']},then:'El evento vuelve a estar programado. Revisa sus datos.'}],default:'Cambió la fecha, el horario, el lugar o la modalidad del evento. Revisa los detalles.'}}}}
 ];}
module.exports={changeKind,notificationStages};
