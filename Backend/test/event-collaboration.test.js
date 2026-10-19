const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),path=require('node:path'),jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app');
const User=require('../src/models/user.model'),Church=require('../src/models/church.model'),Community=require('../src/models/linked-community.model'),Event=require('../src/models/event.model'),svc=require('../src/services/event.service'),v=require('../src/validation/event');
const secret='events-isolated-test-secret-longer-than-32',app=createApp({requireVerifiedEmail:false,jwtSecret:secret,corsOrigins:[],enableTestUi:false}),users={},tokens={};let mongo,church,other,draft,legacy,community,otherCommunity,draftCommunity;
const auth=who=>({Authorization:'Bearer '+tokens[who]});
const create=(body={},who='rep')=>request(app).post('/api/events').set(auth(who)).send({churchId:church.id,title:'Encuentro de prueba',description:'Descripción del encuentro.',startsAt:'2099-10-15T19:00',location:{address:'Plaza de prueba',commune:'Santiago'},...body});
const publish=(e,value='published',who='rep',version=e.version)=>request(app).patch('/api/events/'+e._id+'/publication').set(auth(who)).set('If-Match','"'+version+'"').send({publicationStatus:value});
const patch=(e,body,who='rep',version=e.version)=>request(app).patch('/api/events/'+e._id).set(auth(who)).set('If-Match','"'+version+'"').send(body);
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('collaborations_test'));
 for(const [name,role]of [['admin','admin'],['rep','representative'],['otherRep','representative'],['visitor','user']]){users[name]=await User.create({email:name+'@events.test',password:'unused-test-hash',name,role});tokens[name]=jwt.sign({sv:0},secret,{subject:users[name].id,issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'});}
 const seed=(name,rep,metadata)=>Church.create({identification:{name},location:{commune:'Santiago',address:'Iglesia',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},representatives:[users[rep].id],createdBy:users.admin.id,metadata});
 church=await seed('Publicada','rep',{dataStatus:'verified',firstPublishedByAdminAt:new Date()});other=await seed('Ajena','otherRep',{dataStatus:'published',firstPublishedByAdminAt:new Date()});draft=await seed('Borrador','rep',{dataStatus:'draft'});legacy=await seed('Sin autorización previa','rep',{dataStatus:'published'});
 const group=(churchId,status)=>Community.create({churchId,name:'Ministerio',type:'ministry',status,createdBy:users.admin.id,updatedBy:users.admin.id});community=await group(church.id,'published');otherCommunity=await group(other.id,'published');draftCommunity=await group(church.id,'draft');});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});

const invite=(e,churchId=other.id,who='rep')=>request(app).post('/api/events/'+e._id+'/collaborations').set(auth(who)).set('If-Match','"'+e.version+'"').send({churchId});
const act=(e,action,who='otherRep',churchId=other.id)=>request(app).patch('/api/events/'+e._id+'/collaborations/'+churchId).set(auth(who)).set('If-Match','"'+e.version+'"').send({action});
const notices=who=>request(app).get('/api/notifications').set(auth(who)).expect(200);
async function ready(){return (await publish((await create({openCollaboration:true}).expect(201)).body.data).expect(200)).body.data;}
test('Un solo propietario, invitaciones únicas y concurrencia entre respuestas',async()=>{
 let e=await ready();await invite(e,church.id).expect(400);await invite(e,other.id,'visitor').expect(403);await invite(e,other.id,'otherRep').expect(403);await invite(e,draft.id).expect(404);
 const results=await Promise.all([invite(e),invite(e)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);e.version=results.find(r=>r.status===201).body.version;await invite(e).expect(409);
 const publicBefore=(await request(app).get('/api/events/'+e._id).expect(200)).body.data;assert.equal(publicBefore.openCollaboration,true);assert.deepEqual(publicBefore.collaborators,[]);assert.equal(publicBefore.collaborations,undefined);
 await act(e,'accept','visitor').expect(403);await act(e,'accept','rep').expect(403);await act(e,'withdraw_owner','otherRep').expect(403);
 const answers=await Promise.all([act(e,'accept'),act(e,'reject')]);assert.deepEqual(answers.map(r=>r.status).sort(),[200,409]);let row=await Event.findById(e._id);assert.equal(row.collaborations.length,1);assert.equal(row.collaborations[0].history.length,2);assert.equal(String(row.churchId),church.id);assert.equal(await Event.countDocuments({_id:e._id}),1);
 await request(app).patch('/api/events/'+e._id).set(auth('otherRep')).set('If-Match','"'+row.version+'"').send({title:'Intrusión'}).expect(403);await request(app).patch('/api/events/'+e._id+'/status').set(auth('otherRep')).set('If-Match','"'+row.version+'"').send({eventStatus:'cancelled',cancellationReason:'No autorizado'}).expect(403);
 await request(app).get('/api/events/'+e._id+'/participation-counts').set(auth('otherRep')).expect(403);
 let simultaneous=await ready();simultaneous.version=(await invite(simultaneous).expect(201)).body.version;const race=await Promise.all([act(simultaneous,'accept'),act(simultaneous,'withdraw_owner','rep')]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);const final=await Event.findById(simultaneous._id);assert.equal(final.collaborations[0].history.length,2);assert.ok(['accepted','withdrawn'].includes(final.collaborations[0].status));
});
test('Aceptación pública, privacidad de colaboradora y retirada en ambos sentidos',async()=>{
 let e=await ready();e.version=(await invite(e).expect(201)).body.version;e.version=(await act(e,'accept').expect(200)).body.version;
 let pub=(await request(app).get('/api/events/'+e._id).expect(200)).body.data;assert.deepEqual(pub.collaborators,[{_id:other.id,name:'Ajena'}]);assert.equal(pub.churchId,church.id);assert.equal(pub.organizer._id,church.id);
 const list=await request(app).get('/api/events?associatedChurchId='+other.id).expect(200);assert.ok(list.body.data.some(x=>x._id===e._id));
 await Church.updateOne({_id:other.id},{$set:{'metadata.dataStatus':'draft'}});pub=(await request(app).get('/api/events/'+e._id).expect(200)).body.data;assert.deepEqual(pub.collaborators,[]);assert.equal(pub.eventStatus,'scheduled');assert.equal((await request(app).get('/api/events?associatedChurchId='+other.id).expect(200)).body.pagination.total,0);
 await Church.updateOne({_id:other.id},{$set:{'metadata.dataStatus':'published'}});e.version=(await act(e,'withdraw_guest').expect(200)).body.version;assert.deepEqual((await request(app).get('/api/events/'+e._id).expect(200)).body.data.collaborators,[]);
 e.version=(await act(e,'reinvite','rep').expect(200)).body.version;e.version=(await act(e,'reject').expect(200)).body.version;await act(e,'accept').expect(409);
 e.version=(await act(e,'reinvite','admin').expect(200)).body.version;e.version=(await act(e,'accept','admin').expect(200)).body.version;e.version=(await act(e,'withdraw_owner','rep').expect(200)).body.version;
 const doc=await Event.findById(e._id);assert.equal(doc.collaborations[0].status,'withdrawn');assert.equal(doc.collaborations[0].history.filter(h=>h.actorRole==='admin').length,2);assert.ok(doc.collaborations[0].history.every(h=>h.actor&&h.at));
});
test('Notificaciones compartidas resueltas por otro representante y aislamiento de bandeja',async()=>{
 await Church.updateOne({_id:other.id},{$addToSet:{representatives:users.rep.id}});let e=await ready();e.version=(await invite(e).expect(201)).body.version;
 const find=r=>r.body.data.find(n=>n.source==='collaboration'&&n.eventId===e._id);const before=find(await notices('otherRep'));assert.equal(before.read,false);assert.equal(find(await notices('rep')).read,false);assert.equal(find(await notices('visitor')),undefined);
 await request(app).patch('/api/notifications/'+before._id+'/read').set(auth('visitor')).expect(404);await request(app).patch('/api/notifications/'+before._id+'/read').set(auth('otherRep')).expect(200);assert.equal(find(await notices('rep')).read,true);
 e.version=(await act(e,'reject').expect(200)).body.version;assert.equal(find(await notices('otherRep')).read,true);
 e.version=(await act(e,'reinvite','rep').expect(200)).body.version;assert.equal(find(await notices('otherRep')).read,false);e.version=(await act(e,'accept','rep').expect(200)).body.version;assert.ok((await notices('otherRep')).body.data.filter(n=>n.eventId===e._id).every(n=>n.read));
 await request(app).get('/event-collaborations').expect(404);await request(app).get('/api/event-collaborations').set(auth('visitor')).expect(403);
 await Church.updateOne({_id:other.id},{$pull:{representatives:users.rep.id}});await request(app).get('/api/event-collaborations?churchId='+other.id).set(auth('rep')).expect(403);
 const inbox=(await request(app).get('/api/event-collaborations?eventId='+e._id).set(auth('otherRep')).expect(200)).body;assert.equal(inbox.data[0].status,'accepted');assert.equal(inbox.data[0].event.title,e.title);assert.ok(!JSON.stringify(inbox).includes(users.visitor.email));
 await Church.updateOne({_id:church.id},{$set:{active:false}});assert.equal((await request(app).get('/api/event-collaborations?eventId='+e._id).set(auth('otherRep')).expect(200)).body.data[0].event,null);assert.equal(find(await notices('otherRep')),undefined);await act(e,'withdraw_guest').expect(200);await Church.updateOne({_id:church.id},{$set:{active:true}});
});

test('Colaboradoras aceptadas reciben avisos de cambios y cancelación sin permisos de edición',async()=>{
 let e=await ready();e.version=(await invite(e).expect(201)).body.version;e.version=(await act(e,'accept').expect(200)).body.version;
 e=(await patch(e,{startsAt:'2099-10-18T19:00'}).expect(200)).body.data;
 const rows=(await notices('otherRep')).body.data.filter(n=>n.eventId===e._id);assert.equal(rows.filter(n=>!n.read).length,1);assert.equal(rows.find(n=>!n.read).source,'collaboration');
 const notice=rows.find(n=>!n.read);await request(app).patch('/api/notifications/'+notice._id+'/read').set(auth('otherRep')).expect(200);
 e=(await request(app).patch('/api/events/'+e._id+'/status').set(auth('rep')).set('If-Match','"'+e.version+'"').send({eventStatus:'cancelled',cancellationReason:'Cancelación de prueba'}).expect(200)).body.data;assert.equal((await notices('otherRep')).body.data.filter(n=>n.eventId===e._id&&!n.read).length,1);
 await act(e,'accept').expect(409);assert.equal((await Event.findById(e._id)).collaborations[0].history.length,4);
});

test('Límites y ciclo de disponibilidad: no invita borradores, pasados, cancelados ni acepta iglesia oculta',async()=>{
 const d=(await create().expect(201)).body.data;await invite(d).expect(409);
 let e=await ready();e.version=(await invite(e).expect(201)).body.version;await Church.updateOne({_id:other.id},{$set:{active:false}});await act(e,'accept').expect(409);await Church.updateOne({_id:other.id},{$set:{active:true}});
 await Event.updateOne({_id:e._id},{$set:{startsAt:new Date(Date.now()-1000)}});await act(e,'accept').expect(409);await act(e,'reject').expect(200);
 e=await ready();await Event.updateOne({_id:e._id},{$set:{eventStatus:'cancelled'}});await invite(e).expect(409);
 e=await ready();await Event.updateOne({_id:e._id},{$set:{collaborations:Array.from({length:100},()=>({churchId:new (require('mongoose').Types.ObjectId)(),status:'withdrawn',history:[]}))}});const limited=await invite(e).expect(409);assert.equal(limited.body.error.code,'INVITATION_LIMIT');
 await Event.updateOne({_id:e._id},{$set:{'collaborations.$[].status':'accepted'}});e=(await patch(e,{venue:'Nuevo recinto para todas las colaboradoras'}).expect(200)).body.data;assert.ok((await Event.findById(e._id)).collaborations.every(c=>c.history.length===1));
});
