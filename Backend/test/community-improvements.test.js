const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),path=require('node:path');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model'),Church=require('../src/models/church.model'),Visit=require('../src/models/visit.model'),svc=require('../src/services/visit.service');
const app=createApp({requireVerifiedEmail:false,jwtSecret:'visits-test-only-secret-longer-than-32-characters',corsOrigins:[],enableTestUi:false});let mongo,c,otherChurch,users={},tokens={},visitId;
const auth=name=>({Authorization:'Bearer '+tokens[name]});
const option=async()=> (await request(app).get('/api/churches/'+c.id+'/visit-options').expect(200)).body;
const send=async(extra={})=>{const o=await option();return request(app).post('/api/churches/'+c.id+'/visits').set(auth('visitor')).send({optionKey:o.data[0].optionKey,startsAt:o.data[0].startsAt,version:o.version,message:'Voy con mi familia',requestReply:true,...extra});};
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('visits_test'));for(const [name,role]of [['visitor','user'],['stranger','user'],['rep','representative'],['otherRep','representative'],['admin','admin']]){await request(app).post('/api/auth/register').send({email:name+'@visits.test',password:'Visit-test-123',name}).expect(201);users[name]=await User.findOneAndUpdate({email:name+'@visits.test'},{$set:{role}},{returnDocument:'after'});tokens[name]=(await request(app).post('/api/auth/login').send({email:name+'@visits.test',password:'Visit-test-123'}).expect(200)).body.token;}
 c=await Church.create({identification:{name:'Visitas Santiago'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'published'},createdBy:users.admin._id,representatives:[users.rep._id],firstVisit:{requestsEnabled:true},meetings:[{type:'Culto',modality:'Presencial',frequencyNotes:'Todos los domingos. Llegar 10 minutos antes.',schedule:[{day:'Domingo',startTime:'11:00',durationMinutes:90}]},{type:'Oración',frequencyNotes:'Primer viernes del mes',schedule:[{day:'Viernes',startTime:'19:00'}]},{type:'Online',modality:'Online',schedule:[{day:'Lunes',startTime:'19:00'}]}]});otherChurch=await Church.create({identification:{name:'Otra comunidad'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},createdBy:users.admin._id,representatives:[users.otherRep._id]});await Visit.init();});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});

test('Solicitud conjunta, concesión exclusiva de admin y checklist privado',async()=>{
 const draft=await Church.create({identification:{name:'Verificar'},location:{commune:'Santiago',address:'Dirección',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},christianIdentity:{denomination:'Bautista'},doctrine:{officialStatement:'Declaración'},meetingTypes:['Culto'],leadership:{mainLeader:{name:'Pastor'}},verification:{source:'Representante',authorized:true},createdBy:users.admin._id,representatives:[users.rep._id]});
 const path='/api/churches/'+draft.id;
 await request(app).get('/api/churches/manage/'+draft.id+'/checklist').set(auth('visitor')).expect(403);
 await request(app).get('/api/churches/manage/'+draft.id+'/checklist').set(auth('otherRep')).expect(403);
 const check=(await request(app).get('/api/churches/manage/'+draft.id+'/checklist').set(auth('rep')).expect(200)).body.data;
 assert.equal(check.ready,true);assert.equal(check.sections.length,9);assert.ok(check.percent<100);
 await request(app).post(path+'/publication-request').set(auth('rep')).send({verificationRequested:true}).expect(200);
 await request(app).patch(path+'/status').set(auth('rep')).send({status:'verified'}).expect(403);
 let r=(await request(app).patch(path+'/status').set(auth('admin')).send({status:'published'}).expect(200)).body.data;assert.equal(r.publicationRequest.status,'pending');
 r=(await request(app).patch(path+'/status').set(auth('admin')).send({status:'verified'}).expect(200)).body.data;assert.equal(r.publicationRequest.status,'resolved');
 assert.equal((await request(app).get(path).expect(200)).body.data.metadata.dataStatus,'verified');
});
test('Autor corrige, vuelve a moderación, retira y otro usuario no puede editar',async()=>{
 const E=require('../src/models/experience.model');await User.updateOne({_id:users.visitor.id},{$set:{membershipChurch:c.id}});
 const fields={category:'testimony',title:'Experiencia propia',displayName:'Visitante',body:'Esta es una experiencia de prueba con suficiente contenido para revisar.'};
 let e=await E.create({...fields,church:c.id,author:users.visitor.id,status:'approved'});
 await request(app).patch('/api/experiences/'+e.id).set(auth('stranger')).send({...fields,version:0}).expect(404);
 await request(app).patch('/api/experiences/'+e.id).set(auth('visitor')).send({...fields,title:'Relato corregido',version:0}).expect(200);
 assert.equal((await E.findById(e.id)).status,'pending');assert.equal((await request(app).get('/api/churches/'+c.id+'/experiences').expect(200)).body.data.length,0);
 await request(app).patch('/api/experiences/'+e.id).set(auth('visitor')).send({...fields,version:0}).expect(409);
 await request(app).patch('/api/experiences/'+e.id+'/moderation').set(auth('rep')).send({status:'approved',version:1}).expect(200);
 await User.updateOne({_id:users.visitor.id},{$set:{membershipChurch:null}});
 await request(app).post('/api/experiences/'+e.id+'/withdraw').set(auth('visitor')).send({version:2}).expect(200);
 await request(app).patch('/api/experiences/'+e.id+'/moderation').set(auth('rep')).send({status:'approved',version:3}).expect(409);
 assert.equal((await E.findById(e.id)).status,'withdrawn');
});
test('Reportes: autenticación, duplicados, aislamiento, resolución y datos privados',async()=>{
 const E=require('../src/models/experience.model'),e=await E.create({church:c.id,author:users.visitor.id,title:'Reporte de prueba',body:'Relato para probar el mecanismo de moderación de contenido reportado.',displayName:'Persona',status:'approved'});
 const path='/api/experiences/'+e.id;
 await request(app).post(path+'/reports').send({reason:'Información personal'}).expect(401);
 const results=await Promise.all([1,2].map(()=>request(app).post(path+'/reports').set(auth('stranger')).send({reason:'Información personal'})));assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
 const publicRows=(await request(app).get('/api/churches/'+c.id+'/experiences').expect(200)).body.data;assert.equal(publicRows[0].reports,undefined);
 assert.equal((await request(app).get('/api/experiences/manage?reported=true').set(auth('otherRep')).expect(200)).body.data.length,0);
 const rows=(await request(app).get('/api/experiences/manage?reported=true').set(auth('rep')).expect(200)).body.data;assert.equal(rows[0].reports[0].by,undefined);
 await request(app).patch(path+'/moderation').set(auth('otherRep')).send({status:'resolve',version:1,reason:'Revisado sin infracción'}).expect(403);
 await request(app).patch(path+'/moderation').set(auth('rep')).send({status:'resolve',version:1,reason:'Revisado sin infracción'}).expect(200);
 const updated=await E.findById(e.id);assert.equal(updated.status,'approved');assert.equal(updated.reports[0].status,'resolved');assert.equal(updated.reports[0].resolution,'Revisado sin infracción');
 // Compatibilidad con experiencias antiguas sin arreglo de reportes.
 await E.collection.updateOne({_id:e._id},{$unset:{reports:''}});
 await request(app).patch(path+'/moderation').set(auth('rep')).send({status:'rejected',version:2,reason:'Revisión posterior'}).expect(200);
});
test('Recuperar descartada pertenece solo a su autor y vuelve al conjunto elegible',async()=>{
 await request(app).post('/api/interactions').set(auth('visitor')).send({churchId:c.id,type:'discarded'}).expect(200);
 assert.ok((await request(app).get('/api/users/me/interactions?type=discarded').set(auth('visitor')).expect(200)).body.data.some(r=>r.churchId===c.id));
 await request(app).delete('/api/interactions/'+c.id).set(auth('stranger')).expect(204);
 assert.equal((await request(app).get('/api/users/me/interactions?type=discarded').set(auth('visitor')).expect(200)).body.pagination.total,1);
 await request(app).delete('/api/interactions/'+c.id).set(auth('visitor')).expect(204);
 assert.equal((await request(app).get('/api/users/me/interactions?type=discarded').set(auth('visitor')).expect(200)).body.pagination.total,0);
 const rows=(await request(app).post('/api/recommendations').set(auth('visitor')).send({mode:'traditional',limit:20}).expect(200)).body.data;assert.ok(rows.some(r=>r.churchId===c.id));
});
