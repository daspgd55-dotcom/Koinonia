const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),path=require('node:path'),jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app');
const User=require('../src/models/user.model'),Church=require('../src/models/church.model'),Community=require('../src/models/linked-community.model'),Event=require('../src/models/event.model'),svc=require('../src/services/event.service'),v=require('../src/validation/event');
const secret='events-isolated-test-secret-longer-than-32',app=createApp({jwtSecret:secret,corsOrigins:[],enableTestUi:false}),users={},tokens={};let mongo,church,other,draft,legacy,community,otherCommunity,draftCommunity;
const auth=who=>({Authorization:'Bearer '+tokens[who]});
const create=(body={},who='rep')=>request(app).post('/api/events').set(auth(who)).send({churchId:church.id,title:'Encuentro de prueba',description:'Descripción del encuentro.',startsAt:'2099-10-15T19:00',location:{address:'Plaza de prueba',commune:'Santiago'},...body});
const publish=(e,value='published',who='rep',version=e.version)=>request(app).patch('/api/events/'+e._id+'/publication').set(auth(who)).set('If-Match','"'+version+'"').send({publicationStatus:value});
const patch=(e,body,who='rep',version=e.version)=>request(app).patch('/api/events/'+e._id).set(auth(who)).set('If-Match','"'+version+'"').send(body);
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('participation_test'));
 for(const [name,role]of [['admin','admin'],['rep','representative'],['otherRep','representative'],['visitor','user']]){users[name]=await User.create({email:name+'@events.test',password:'unused-test-hash',name,role});tokens[name]=jwt.sign({sv:0},secret,{subject:users[name].id,issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'});}
 const seed=(name,rep,metadata)=>Church.create({identification:{name},location:{commune:'Santiago',address:'Iglesia',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},representatives:[users[rep].id],createdBy:users.admin.id,metadata});
 church=await seed('Publicada','rep',{dataStatus:'verified',firstPublishedByAdminAt:new Date()});other=await seed('Ajena','otherRep',{dataStatus:'published',firstPublishedByAdminAt:new Date()});draft=await seed('Borrador','rep',{dataStatus:'draft'});legacy=await seed('Sin autorización previa','rep',{dataStatus:'published'});
 const group=(churchId,status)=>Community.create({churchId,name:'Ministerio',type:'ministry',status,createdBy:users.admin.id,updatedBy:users.admin.id});community=await group(church.id,'published');otherCommunity=await group(other.id,'published');draftCommunity=await group(church.id,'draft');});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});

const Participation=require('../src/models/event-participation.model');
const choose=(e,status='interested',who='visitor')=>request(app).put('/api/events/'+e._id+'/participation').set(auth(who)).send({status});
const notices=who=>request(app).get('/api/notifications').set(auth(who)).expect(200);
async function published(){return (await publish((await create().expect(201)).body.data).expect(200)).body.data;}
test('Participación única concurrente, opciones excluyentes, retiro, validación y conteos privados',async()=>{
 const e=await published();await request(app).put('/api/events/'+e._id+'/participation').send({status:'going'}).expect(401);
 const results=await Promise.all(Array.from({length:12},(_,i)=>choose(e,i%2?'going':'interested')));assert.ok(results.every(r=>r.status===200),JSON.stringify(results.map(r=>r.body)));assert.equal(await Participation.countDocuments({event:e._id,user:users.visitor.id}),1);
 await choose(e,'going').expect(200);await choose(e,'invalid').expect(400);await request(app).put('/api/events/'+e._id+'/participation').set(auth('visitor')).send({status:'going',user:users.rep.id}).expect(400);
 const counts=await request(app).get('/api/events/'+e._id+'/participation-counts').set(auth('rep')).expect(200);assert.deepEqual(counts.body.data,{interested:0,going:1});await request(app).get('/api/events/'+e._id+'/participation-counts').set(auth('otherRep')).expect(403);await request(app).get('/api/events/'+e._id+'/participation-counts').set(auth('visitor')).expect(403);
 assert.equal((await request(app).get('/api/events/mine').set(auth('otherRep')).expect(200)).body.pagination.total,0);
 const pub=(await request(app).get('/api/events/'+e._id).expect(200)).body;assert.ok(!JSON.stringify(pub).includes(users.visitor.email));assert.equal(pub.data.participationChanges,undefined);
 await request(app).get('/api/events/'+e._id+'/participation-counts').set(auth('admin')).expect(200);
 await choose(e,'withdrawn').expect(200);assert.equal((await Participation.findOne({event:e._id,user:users.visitor.id})).status,'withdrawn');assert.equal((await request(app).get('/api/events/mine').set(auth('visitor')).expect(200)).body.pagination.total,0);
 const draftEvent=(await create().expect(201)).body.data;await choose(draftEvent).expect(409);
 await Event.updateOne({_id:e._id},{$set:{startsAt:new Date(Date.now()-1000)}});await choose(e).expect(409);
});
test('Avisos durables por cambios relevantes, lectura aislada, no duplicados y cancelación',async()=>{
 let e=await published();await choose(e,'going').expect(200);await choose(e,'interested','otherRep').expect(200);
 let n=(await notices('visitor')).body;assert.equal(n.unread,0);
 e=(await patch(e,{title:'Nuevo texto',description:'Solo cambia la descripción'}).expect(200)).body.data;assert.equal((await notices('visitor')).body.unread,0);
 const results=await Promise.all([patch(e,{startsAt:'2099-10-16T19:00'}),patch(e,{startsAt:'2099-10-17T19:00'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);e=results.find(r=>r.status===200).body.data;
 n=(await notices('visitor')).body;assert.equal(n.unread,1);assert.equal(n.data[0].source,'event');assert.equal(n.data[0].eventId,e._id);assert.equal((await notices('visitor')).body.unread,1);
 await request(app).patch('/api/notifications/'+n.data[0]._id+'/read').set(auth('rep')).expect(404);
 await Promise.all([1,2].map(()=>request(app).patch('/api/notifications/'+n.data[0]._id+'/read').set(auth('visitor')).expect(200)));assert.equal((await notices('visitor')).body.unread,0);assert.equal((await notices('otherRep')).body.unread,1);
 // Cambiar opción mantiene la suscripción y sus lecturas.
 await choose(e,'interested').expect(200);assert.equal((await notices('visitor')).body.unread,0);
 e=(await patch(e,{location:{address:'Otro lugar',commune:'Santiago'}}).expect(200)).body.data;assert.equal((await notices('visitor')).body.unread,1);
 e=(await patch(e,{modality:'online',location:null,onlineUrl:'https://example.test/sala'}).expect(200)).body.data;assert.equal((await notices('visitor')).body.unread,2);
 e=(await request(app).patch('/api/events/'+e._id+'/status').set(auth('rep')).set('If-Match','"'+e.version+'"').send({eventStatus:'cancelled',cancellationReason:'Suspendido por lluvia.'}).expect(200)).body.data;assert.equal((await notices('visitor')).body.unread,3);await choose(e).expect(409);
 const again=(await request(app).patch('/api/events/'+e._id+'/status').set(auth('rep')).set('If-Match','"'+e.version+'"').send({eventStatus:'cancelled',cancellationReason:'Motivo ampliado por lluvia.'}).expect(200)).body.data;assert.equal((await notices('visitor')).body.unread,3);
 await choose(e,'withdrawn').expect(200);assert.equal((await notices('visitor')).body.unread,0);assert.equal((await notices('visitor')).body.data.length,0);
 e=(await request(app).patch('/api/events/'+e._id+'/status').set(auth('rep')).set('If-Match','"'+again.version+'"').send({eventStatus:'scheduled'}).expect(200)).body.data;await choose(e).expect(200);assert.equal((await notices('visitor')).body.unread,0);
 await choose(e,'withdrawn').expect(200);await choose(e,'withdrawn','otherRep').expect(200);
});
test('Archivo e iglesia oculta no filtran contenido; historial conserva intención sin asistencia pendiente',async()=>{
 let e=await published();await choose(e).expect(200);e=(await patch(e,{venue:'Otro recinto'}).expect(200)).body.data;assert.equal((await notices('visitor')).body.unread,1);
 e=(await publish(e,'archived').expect(200)).body.data;assert.equal((await notices('visitor')).body.unread,0);let rows=(await request(app).get('/api/events/mine?view=history').set(auth('visitor')).expect(200)).body.data;assert.equal(rows.find(p=>p.eventId===e._id).event,null);assert.equal((await request(app).get('/api/events/mine').set(auth('visitor')).expect(200)).body.pagination.total,0);
 e=(await publish(e).expect(200)).body.data;await Church.updateOne({_id:church.id},{$set:{active:false}});assert.equal((await notices('visitor')).body.unread,0);await request(app).get('/api/events/'+e._id+'/participation').set(auth('visitor')).expect(404);await choose(e).expect(409);await Church.updateOne({_id:church.id},{$set:{active:true}});
 await Event.updateOne({_id:e._id},{$set:{startsAt:new Date(Date.now()-86400000),effectiveEndsAt:new Date(Date.now()-1000)}});rows=(await request(app).get('/api/events/mine?view=history').set(auth('visitor')).expect(200)).body.data;assert.equal(rows.find(p=>p.eventId===e._id).pending,false);assert.equal(rows.find(p=>p.eventId===e._id).event.displayStatus,'finished');await choose(e,'withdrawn').expect(200);
});
