const {test}=require('node:test'),assert=require('node:assert/strict'),{Types}=require('mongoose');
const {templates,build}=require('../scripts/create-test-events'),Event=require('../src/models/event.model'),svc=require('../src/services/event.service');
const owner={_id:new Types.ObjectId(),active:true,metadata:{dataStatus:'published',firstPublishedByAdminAt:new Date('2026-10-01')},identification:{name:'Iglesia Bíblica Alma'},location:{address:'Dirección de prueba 123',commune:'La Florida',coordinates:{type:'Point',coordinates:[-70.5868,-33.5376]}}},partner={_id:new Types.ObjectId(),identification:{name:'Iglesia Bautista de prueba'}},actor={_id:new Types.ObjectId(),role:'admin',name:'Administrador'},now=new Date('2026-10-18T18:00:00-03:00');
test('Diez eventos completos y coherentes cumplen el modelo y publicación',async()=>{
 const events=templates.map(t=>build(t,owner,partner,actor,now));assert.equal(events.length,10);assert.equal(new Set(events.map(e=>String(e._id))).size,10);
 for(const e of events){await new Event(e).validate();svc.publishable(e,owner,null);assert(e.description.includes('Publicación ficticia'));assert(e.audience.length);assert(e.endsAt>e.startsAt);assert.equal(String(e.churchId),String(owner._id));}
 assert.equal(new Set(events.map(e=>e.modality)).size,3);assert.equal(new Set(events.map(e=>e.participation)).size,3);assert.equal(new Set(events.map(e=>e.category)).size,7);
});
test('Evento del 19 cambia exactamente al mediodía de Santiago',()=>{
 const e=build(templates[0],owner,partner,actor,now);assert.equal(e.endsAt.toISOString(),'2026-10-19T15:00:00.000Z');assert.equal(svc.displayStatus(e,new Date('2026-10-19T11:59:59-03:00')),'scheduled');assert.equal(svc.displayStatus(e,new Date('2026-10-19T12:00:00-03:00')),'finished');
});
test('Colaboración aceptada y pendiente conservan propietario e historial',()=>{
 const accepted=build(templates[1],owner,partner,actor,now),pending=build(templates[7],owner,partner,actor,now);
 assert.equal(accepted.collaborations[0].status,'accepted');assert.deepEqual(accepted.collaborations[0].history.map(h=>h.action),['invite','accept']);assert.equal(String(accepted.collaborations[0].churchId),String(partner._id));assert.equal(String(accepted.churchId),String(owner._id));assert.equal(pending.collaborations[0].status,'pending');
});
test('Historial y cancelación no se confunden; contactos privados se ocultan',()=>{
 const old=build(templates[9],owner,partner,actor,now),cancelled=build(templates[8],owner,partner,actor,now),online=build(templates[3],owner,partner,actor,now);
 assert.equal(svc.displayStatus(old,now),'finished');assert.equal(svc.displayStatus(cancelled,now),'cancelled');assert(cancelled.cancellationReason.length>5);assert.equal(online.location,null);assert.equal(svc.publicData(online,owner,null,now).contact.email,undefined);
});
