const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),path=require('node:path');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model'),Church=require('../src/models/church.model'),Visit=require('../src/models/visit.model'),svc=require('../src/services/visit.service');
const app=createApp({requireVerifiedEmail:false,jwtSecret:'visits-test-only-secret-longer-than-32-characters',corsOrigins:[],enableTestUi:false});let mongo,c,otherChurch,users={},tokens={},visitId;
const auth=name=>({Authorization:'Bearer '+tokens[name]});
const option=async()=> (await request(app).get('/api/churches/'+c.id+'/visit-options').expect(200)).body;
const send=async(extra={})=>{const o=await option();return request(app).post('/api/churches/'+c.id+'/visits').set(auth('visitor')).send({optionKey:o.data[0].optionKey,startsAt:o.data[0].startsAt,version:o.version,message:'Voy con mi familia',requestReply:true,...extra});};
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('visits_test'));for(const [name,role]of [['visitor','user'],['stranger','user'],['rep','representative'],['otherRep','representative'],['admin','admin']]){await request(app).post('/api/auth/register').send({email:name+'@visits.test',password:'Visit-test-123',name}).expect(201);users[name]=await User.findOneAndUpdate({email:name+'@visits.test'},{$set:{role}},{returnDocument:'after'});tokens[name]=(await request(app).post('/api/auth/login').send({email:name+'@visits.test',password:'Visit-test-123'}).expect(200)).body.token;}
 c=await Church.create({identification:{name:'Visitas Santiago'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'published'},createdBy:users.admin._id,representatives:[users.rep._id],firstVisit:{requestsEnabled:true},meetings:[{type:'Culto',modality:'Presencial',frequencyNotes:'Todos los domingos. Llegar 10 minutos antes.',schedule:[{day:'Domingo',startTime:'11:00',durationMinutes:90}]},{type:'Oración',frequencyNotes:'Primer viernes del mes',schedule:[{day:'Viernes',startTime:'19:00'}]},{type:'Online',modality:'Online',schedule:[{day:'Lunes',startTime:'19:00'}]}]});otherChurch=await Church.create({identification:{name:'Otra comunidad'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},createdBy:users.admin._id,representatives:[users.otherRep._id]});await Visit.init();});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});
test('UTC-3 fijo: próxima ocurrencia, medianoche, cambio de semana/año y exclusiones',()=>{
 assert.equal(svc.nextOccurrence('Domingo','11:00',new Date('2026-10-18T13:59:00Z')).toISOString(),'2026-10-18T14:00:00.000Z');
 assert.equal(svc.nextOccurrence('Domingo','11:00',new Date('2026-10-18T14:00:00Z')).toISOString(),'2026-10-25T14:00:00.000Z');
 assert.equal(svc.nextOccurrence('Jueves','00:30',new Date('2026-12-31T02:00:00Z')).toISOString(),'2026-12-31T03:30:00.000Z');
 assert.equal(svc.nextOccurrence('Viernes','00:00',new Date('2026-12-31T20:00:00Z')).toISOString(),'2027-01-01T03:00:00.000Z');
 assert.equal(svc.nextOccurrence('X','11:00'),null);assert.equal(svc.options(c).length,1);assert.equal(svc.options(c)[0].frequencyNotes,'Todos los domingos. Llegar 10 minutos antes.');
 for(const note of ['Semanal','Todos los domingos','Llegar temprano',''])assert.equal(svc.options({meetings:[{type:'Culto',frequencyNotes:note,schedule:[{day:'Domingo',startTime:'11:00'}]}]}).length,1);
});
test('Aviso: requiere autenticación, activación y horario vigente; duplicados concurrentes',async()=>{
 const o=await option(),body={optionKey:o.data[0].optionKey,startsAt:o.data[0].startsAt,version:o.version};
 await request(app).post('/api/churches/'+c.id+'/visits').send(body).expect(401);
 await send({version:999}).then(r=>assert.equal(r.status,409));
 await send({startsAt:'2020-01-01T00:00:00.000Z'}).then(r=>assert.equal(r.status,409));
 await Church.updateOne({_id:c._id},{$set:{'firstVisit.requestsEnabled':false}});assert.equal((await option()).data.length,0);
 await request(app).post('/api/churches/'+c.id+'/visits').set(auth('visitor')).send(body).expect(409);
 await Church.updateOne({_id:c._id},{$set:{'firstVisit.requestsEnabled':true}});
 const results=await Promise.all([1,2].map(()=>request(app).post('/api/churches/'+c.id+'/visits').set(auth('visitor')).send({...body,message:'Voy con mi familia',requestReply:true})));assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);visitId=results.find(r=>r.status===201).body.data._id;
 await send({visitor:users.stranger.id}).then(r=>assert.equal(r.status,400));
 const publicData=await request(app).get('/api/churches/'+c.id).expect(200);assert.ok(!JSON.stringify(publicData.body).includes('Voy con mi familia'));
});
test('Privacidad, asignación actual, lectura compartida del equipo y recepción con respuesta interna',async()=>{
 const mine=await request(app).get('/api/visits/mine').set(auth('visitor')).expect(200);assert.equal(mine.body.data.length,1);
 assert.equal((await request(app).get('/api/visits/mine').set(auth('stranger')).expect(200)).body.data.length,0);
 await request(app).get('/api/visits/manage').set(auth('visitor')).expect(403);
 assert.equal((await request(app).get('/api/visits/manage').set(auth('otherRep')).expect(200)).body.data.length,0);
 const managed=(await request(app).get('/api/visits/manage').set(auth('rep')).expect(200)).body.data[0];assert.equal(managed.visitorName,'visitor');assert.equal(managed.attendance,undefined);assert.ok(!JSON.stringify(managed).includes('@visits.test'));
 await request(app).patch('/api/visits/'+visitId+'/manage').set(auth('otherRep')).send({action:'receive',version:0}).expect(404);
 await request(app).patch('/api/visits/'+visitId).set(auth('stranger')).send({action:'cancel',version:0}).expect(404);
 const notices=(await request(app).get('/api/notifications').set(auth('rep')).expect(200)).body;assert.equal(notices.unread,1);
 assert.equal((await request(app).get('/api/notifications?unreadOnly=true&limit=1').set(auth('rep')).expect(200)).body.data.length,1);
 const nid=notices.data[0]._id;await request(app).patch('/api/notifications/'+nid+'/read').set(auth('otherRep')).expect(404);await request(app).patch('/api/notifications/'+nid+'/read').set(auth('rep')).expect(200);
 assert.equal((await request(app).get('/api/notifications').set(auth('rep')).expect(200)).body.unread,0);
 assert.equal((await request(app).get('/api/notifications').set(auth('admin')).expect(200)).body.unread,0);
 const pending=(await request(app).get('/api/notifications?unreadOnly=true').set(auth('rep')).expect(200)).body;assert.deepEqual(pending.data,[]);assert.equal(pending.pagination.total,0);assert.equal(pending.unread,0);assert.equal((await request(app).get('/api/notifications?unreadOnly=false').set(auth('rep')).expect(200)).body.data.length,1);await request(app).get('/api/notifications?unreadOnly=bad').set(auth('rep')).expect(400);
 await request(app).patch('/api/visits/'+visitId+'/manage').set(auth('rep')).send({action:'read',version:1}).expect(200);
 await Church.updateOne({_id:c.id},{$addToSet:{representatives:users.otherRep._id}});
 assert.equal((await request(app).get('/api/visits/manage').set(auth('otherRep')).expect(200)).body.data[0].read,true);
 assert.equal((await request(app).get('/api/notifications').set(auth('otherRep')).expect(200)).body.unread,0);
 await Church.updateOne({_id:c.id},{$pull:{representatives:users.otherRep._id}});
 await request(app).patch('/api/visits/'+visitId+'/manage').set(auth('rep')).send({action:'receive',version:2,message:'Te esperamos en la entrada.'}).expect(200);
 await Church.updateOne({_id:c.id},{$addToSet:{representatives:users.otherRep._id}});
 assert.equal((await request(app).get('/api/notifications').set(auth('otherRep')).expect(200)).body.unread,0);
 assert.equal((await request(app).get('/api/visits/manage').set(auth('otherRep')).expect(200)).body.data[0].read,true);
 await Church.updateOne({_id:c.id},{$pull:{representatives:users.otherRep._id}});
 const visitorNotifications=(await request(app).get('/api/notifications').set(auth('visitor')).expect(200)).body.data;assert.equal(visitorNotifications[0].text,'Te esperamos en la entrada.');
 await Church.updateOne({_id:c.id},{$set:{representatives:[]}});assert.equal((await request(app).get('/api/notifications').set(auth('rep')).expect(200)).body.data.length,0);await Church.updateOne({_id:c.id},{$set:{representatives:[users.rep._id]}});
});
test('Cancelación, nueva intención y cambio de horario conservan la fecha original',async()=>{
 const original=await Visit.findById(visitId);await Church.updateOne({_id:c.id},{$set:{'meetings.0.schedule.0.startTime':'12:00'},$inc:{'metadata.version':1}});
 assert.equal((await Visit.findById(visitId)).startsAt.toISOString(),original.startsAt.toISOString());
 await request(app).patch('/api/visits/'+visitId).set(auth('visitor')).send({action:'cancel',version:0}).expect(409);
 await request(app).patch('/api/visits/'+visitId).set(auth('visitor')).send({action:'cancel',version:3}).expect(200);
 assert.equal((await request(app).get('/api/visits/mine').set(auth('visitor')).expect(200)).body.data.length,0);
 const fresh=await send();assert.equal(fresh.status,201);visitId=fresh.body.data._id;
 await request(app).patch('/api/visits/'+visitId+'/manage').set(auth('rep')).send({action:'change',version:0,message:'La reunión se suspendió; elige otro horario.'}).expect(200);
 assert.equal((await Visit.findById(visitId)).cancelledBy,'church');
});
test('Finaliza sin inferir inasistencia; seguimiento único y privado al consultar, con IDs distintos',async()=>{
 const fresh=await send();assert.equal(fresh.status,201);visitId=fresh.body.data._id;
 await request(app).patch('/api/visits/'+visitId).set(auth('visitor')).send({action:'attendance',attendance:'attended',version:0}).expect(400);
 await Visit.updateOne({_id:visitId},{$set:{endsAt:new Date(0)}});
 const other=await Visit.create({church:c._id,visitor:users.visitor._id,churchName:'Otra fecha',visitorName:'visitor',optionKey:'another',meeting:'Culto',startsAt:new Date(0),endsAt:new Date(1)});
 await Promise.all([1,2].map(()=>request(app).get('/api/notifications').set(auth('visitor')).expect(200)));
 const docs=await Visit.find({_id:{$in:[visitId,other._id]}});assert.ok(docs.every(d=>d.events.filter(e=>e.kind==='followup').length===1));assert.notEqual(String(docs[0].events.find(e=>e.kind==='followup')._id),String(docs[1].events.find(e=>e.kind==='followup')._id));
 const history=(await request(app).get('/api/visits/mine?view=history').set(auth('visitor')).expect(200)).body.data.find(x=>x._id===visitId);assert.equal(history.status,'completed');assert.equal(history.attendance,'unknown');
 await request(app).patch('/api/visits/'+visitId).set(auth('visitor')).send({action:'cancel',version:0}).expect(409);
 await request(app).patch('/api/visits/'+visitId).set(auth('visitor')).send({action:'attendance',attendance:'missed',version:0}).expect(200);
 assert.equal((await User.findById(users.visitor._id)).membershipChurch,null);assert.ok((await Visit.findById(visitId)).events.find(e=>e.kind==='followup').readBy.some(id=>String(id)===users.visitor.id));
 const staff=(await request(app).get('/api/visits/manage?view=history').set(auth('rep')).expect(200)).body.data;assert.ok(staff.every(x=>x.attendance===undefined));
});

test('Frecuencia explícita, exclusión voluntaria y orden por tipo de reunión',()=>{
 const meeting={modality:'Presencial',schedule:[{day:'Domingo',startTime:'11:00'}]};
 const data=svc.options({meetings:[{...meeting,type:'Zeta',frequency:'weekly',frequencyNotes:'Actividad mensual adicional'},{...meeting,type:'Alabanza',frequency:'weekly'},{...meeting,type:'Mensual',frequency:'monthly'},{...meeting,type:'Privada',frequency:'weekly',visitsEnabled:false}]});
 assert.deepEqual(data.map(x=>x.meeting),['Alabanza','Zeta']);
});
test('Reprogramar conserva mensaje e historial, valida dueño/versiones y reinicia recepción',async()=>{
 await Church.updateOne({_id:c.id},{$push:{meetings:{type:'Jóvenes',modality:'Presencial',frequency:'weekly',schedule:[{day:'Sábado',startTime:'18:00'}]}}});
 const o=await option(),first=o.data[0],second=o.data[1];
 const result=await request(app).post('/api/churches/'+c.id+'/visits').set(auth('stranger')).send({optionKey:first.optionKey,startsAt:first.startsAt,version:o.version,message:'Mensaje conservado'}).expect(201),id=result.body.data._id;
 await request(app).patch('/api/visits/'+id+'/manage').set(auth('rep')).send({action:'receive',version:0}).expect(200);
 let rows=(await request(app).get('/api/visits/manage?filter=received').set(auth('rep')).expect(200)).body.data;
 assert.equal(rows.find(x=>x._id===id).receivedByName,'rep');assert.ok(rows.find(x=>x._id===id).receivedAt);assert.ok((await request(app).get('/api/notifications').set(auth('rep')).expect(200)).body.data.filter(x=>x.visitId===id&&x.audience==='staff').every(x=>x.read));
 const body={optionKey:second.optionKey,startsAt:second.startsAt,churchVersion:o.version,version:1};
 await request(app).patch('/api/visits/'+id+'/reschedule').set(auth('visitor')).send(body).expect(404);
 await request(app).patch('/api/visits/'+id+'/reschedule').set(auth('stranger')).send({...body,churchVersion:999}).expect(409);
 await request(app).patch('/api/visits/'+id+'/reschedule').set(auth('stranger')).send({...body,version:0}).expect(409);
 const changed=(await request(app).patch('/api/visits/'+id+'/reschedule').set(auth('stranger')).send(body).expect(200)).body.data;
 assert.equal(changed.message,'Mensaje conservado');assert.equal(changed.status,'sent');assert.equal(changed.scheduleHistory[0].startsAt,first.startsAt);assert.equal(changed.startsAt,second.startsAt);
 const doc=await Visit.findById(id);assert.equal(doc.receivedAt,undefined);assert.equal(doc.events.filter(e=>e.kind==='rescheduled').length,1);assert.equal((await request(app).get('/api/visits/manage').set(auth('rep')).expect(200)).body.data.find(x=>x._id===id).read,false);assert.ok((await request(app).get('/api/notifications').set(auth('rep')).expect(200)).body.data.some(x=>x.kind==='rescheduled'&&!x.read));
 rows=(await request(app).get('/api/visits/manage?filter=pending').set(auth('rep')).expect(200)).body.data;assert.ok(rows.some(x=>x._id===id));
 assert.ok((await request(app).get('/api/visits/manage?filter=week').set(auth('rep')).expect(200)).body.data.some(x=>x._id===id));
 await request(app).patch('/api/visits/'+id).set(auth('stranger')).send({action:'cancel',version:2}).expect(200);
 await request(app).patch('/api/visits/'+id+'/reschedule').set(auth('stranger')).send({...body,version:3}).expect(409);
});


test('Campana filtra antes de paginar aunque los avisos recientes estén leídos',async()=>{
 const base=new Date('2099-01-01T00:00:00Z');const pending={audience:'visitor',kind:'reply',text:'Pendiente antiguo',at:base,readBy:[]};
 const recent=Array.from({length:6},(_,i)=>({audience:'visitor',kind:'reply',text:'Ya leído '+i,at:new Date(+base+(i+1)*1000),readBy:[users.visitor._id]}));
 await Visit.updateOne({_id:visitId},{$push:{events:{$each:[pending,...recent]}}});
 const all=(await request(app).get('/api/notifications?limit=5').set(auth('visitor')).expect(200)).body;assert.ok(all.data.every(n=>n.read));
 const only=(await request(app).get('/api/notifications?unreadOnly=true&limit=1').set(auth('visitor')).expect(200)).body;assert.equal(only.data[0].text,'Pendiente antiguo');assert.equal(only.data[0].read,false);assert.ok(only.pagination.total>0);
});
