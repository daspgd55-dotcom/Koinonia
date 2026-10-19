const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),path=require('node:path'),jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app');
const User=require('../src/models/user.model'),Church=require('../src/models/church.model'),Community=require('../src/models/linked-community.model'),Event=require('../src/models/event.model'),svc=require('../src/services/event.service'),v=require('../src/validation/event');
const secret='events-isolated-test-secret-longer-than-32',app=createApp({jwtSecret:secret,corsOrigins:[],enableTestUi:false}),users={},tokens={};let mongo,church,other,draft,legacy,community,otherCommunity,draftCommunity;
const auth=who=>({Authorization:'Bearer '+tokens[who]});
const create=(body={},who='rep')=>request(app).post('/api/events').set(auth(who)).send({churchId:church.id,title:'Encuentro de prueba',description:'Descripción del encuentro.',startsAt:'2099-10-15T19:00',location:{address:'Plaza de prueba',commune:'Santiago'},...body});
const publish=(e,value='published',who='rep',version=e.version)=>request(app).patch('/api/events/'+e._id+'/publication').set(auth(who)).set('If-Match','"'+version+'"').send({publicationStatus:value});
const patch=(e,body,who='rep',version=e.version)=>request(app).patch('/api/events/'+e._id).set(auth(who)).set('If-Match','"'+version+'"').send(body);
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('events_test'));
 for(const [name,role]of [['admin','admin'],['rep','representative'],['otherRep','representative'],['visitor','user']]){users[name]=await User.create({email:name+'@events.test',password:'unused-test-hash',name,role});tokens[name]=jwt.sign({sv:0},secret,{subject:users[name].id,issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'});}
 const seed=(name,rep,metadata)=>Church.create({identification:{name},location:{commune:'Santiago',address:'Iglesia',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},representatives:[users[rep].id],createdBy:users.admin.id,metadata});
 church=await seed('Publicada','rep',{dataStatus:'verified',firstPublishedByAdminAt:new Date()});other=await seed('Ajena','otherRep',{dataStatus:'published',firstPublishedByAdminAt:new Date()});draft=await seed('Borrador','rep',{dataStatus:'draft'});legacy=await seed('Sin autorización previa','rep',{dataStatus:'published'});
 const group=(churchId,status)=>Community.create({churchId,name:'Ministerio',type:'ministry',status,createdBy:users.admin.id,updatedBy:users.admin.id});community=await group(church.id,'published');otherCommunity=await group(other.id,'published');draftCommunity=await group(church.id,'draft');});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});

test('Portada en borrador: permisos, versión, proveedor simulado y búsqueda literal',async()=>{
 const e=(await create({title:'Encuentro [especial]'}).expect(201)).body.data,url='/api/events/'+e._id+'/cover?frame=wide',bytes=Buffer.from([255,216,255,0]);
 const upload=(who='rep',version=1)=>request(app).post(url).set(auth(who)).set('If-Match','"'+version+'"').set('Content-Type','image/jpeg').send(bytes);
 await upload('otherRep').expect(403);await upload('visitor').expect(403);await upload().expect(503);
 app.locals.config.cloudinary={cloudName:'events-test',apiKey:'test',apiSecret:'test'};app.locals.mediaFetch=async(u,o)=>({ok:true,json:async()=>({public_id:o.body.get('public_id'),secure_url:'https://res.cloudinary.com/events-test/image/upload/'+o.body.get('public_id')+'.webp'})});
 try{const result=(await upload().expect(201)).body.data;assert.equal(result.cover.frame,'wide');assert.equal(result.publicationStatus,'draft');assert.equal(result.version,2);await upload().expect(409);
 await request(app).post(url).set(auth('rep')).set('If-Match','"2"').set('Content-Type','image/jpeg').send(Buffer.from('invalid')).expect(400);
 const removed=(await patch(result,{cover:null}).expect(200)).body.data;assert.equal(removed.cover,null);
 }finally{delete app.locals.config.cloudinary;delete app.locals.mediaFetch;}
 const result=(await request(app).get('/api/events/manage?q='+encodeURIComponent('[especial]')).set(auth('rep')).expect(200)).body;assert.equal(result.pagination.total,1);assert.equal(result.data[0]._id,e._id);
});

test('UTC-3 fijo, fechas reales y cierre local sin depender de horario estacional',()=>{
 assert.equal(v.instant('2026-01-15T19:30').toISOString(),'2026-01-15T22:30:00.000Z');assert.equal(v.instant('2026-07-15T19:30').toISOString(),'2026-07-15T22:30:00.000Z');
 assert.equal(v.instant('2026-10-15T23:30-03:00').toISOString(),'2026-10-16T02:30:00.000Z');assert.equal(v.instant('2026-10-15T19:30Z').toISOString(),'2026-10-15T19:30:00.000Z');
 for(const value of ['2026-02-30T12:00','2025-02-29T12:00','2026-04-31T12:00','2026-10-15','2026-10-15T24:00','2026-10-15T12:00+14:30'])assert.equal(v.instant(value),null);
 const end=svc.effectiveEnd('2026-12-31T23:30-03:00');assert.equal(end.toISOString(),'2027-01-01T03:00:00.000Z');assert.equal(svc.effectiveEnd('2024-02-29T12:00-03:00').toISOString(),'2024-03-01T03:00:00.000Z');
 assert.equal(svc.displayStatus({eventStatus:'scheduled',effectiveEndsAt:end},new Date(+end-1)),'scheduled');assert.equal(svc.displayStatus({eventStatus:'scheduled',effectiveEndsAt:end},end),'finished');assert.equal(svc.displayStatus({eventStatus:'cancelled',effectiveEndsAt:end},end),'cancelled');
 assert.equal(svc.effectiveEnd('2026-10-15T12:00Z','2026-10-16T15:00Z').toISOString(),'2026-10-16T15:00:00.000Z');
});
test('Roles, asignación, organizador y borradores incompletos antes de publicación',async()=>{
 await request(app).post('/api/events').send({}).expect(401);await create({},'visitor').expect(403);await create({},'otherRep').expect(403);await create({communityId:otherCommunity.id}).expect(400);await create({churchId:'000000000000000000000000'}).expect(404);
 const e=(await create({churchId:draft.id,startsAt:null,description:'',location:null}).expect(201)).body.data;assert.equal(e.publicationStatus,'draft');assert.equal(e.eventStatus,'scheduled');assert.equal(e.startsAt,null);await publish(e).expect(409);await publish(e,'published','admin').expect(409);
 await request(app).get('/api/events/manage/'+e._id).set(auth('otherRep')).expect(403);await request(app).get('/api/events/manage').set(auth('visitor')).expect(403);await request(app).get('/api/events/manage?churchId='+draft.id).set(auth('otherRep')).expect(403);
 const le=(await create({churchId:legacy.id}).expect(201)).body.data;await publish(le).expect(409);
 const ce=(await create({communityId:draftCommunity.id}).expect(201)).body.data;await publish(ce).expect(409);
 const adminEvent=(await create({churchId:other.id},'admin').expect(201)).body.data;await publish(adminEvent,'published','admin').expect(200);await patch(adminEvent,{title:'Intrusión'}).expect(403);
 const rows=(await request(app).get('/api/events/manage').set(auth('otherRep')).expect(200)).body.data;assert.ok(rows.length>0&&rows.every(x=>x.churchId===other.id));
 await request(app).get('/api/events/'+e._id).expect(404);
});
test('Valida fechas y modalidades, publicación exige información, PATCH conserva campos',async()=>{
 for(const body of [{startsAt:'2026-02-30T12:00'},{endsAt:'2099-10-15T18:00'},{startsAt:null,endsAt:'2099-10-15T20:00'},{modality:'online'},{onlineUrl:'https://example.test'},{registrationUrl:'javascript:alert(1)'},{category:'invalid'},{publicationStatus:'published'},{eventStatus:'cancelled'},{effectiveEndsAt:'2099-10-15T20:00'},{location:{address:'Prueba',commune:'Santiago',coordinates:{type:'Point',coordinates:[181,0]}}},{cover:{url:'file:///private',source:'Prueba'}}])await create(body).expect(400);
 const e=(await create({modality:'hybrid',onlineUrl:null,participation:'registration'}).expect(201)).body.data;await publish(e).expect(400);
 const fixed=(await patch(e,{onlineUrl:'https://example.test/join',registrationInstructions:'Inscríbete por el canal oficial.'}).expect(200)).body.data;assert.equal(fixed.title,e.title);assert.equal(fixed.startsAt,'2099-10-15T22:00:00.000Z');assert.equal(fixed.effectiveEndsAt,'2099-10-16T03:00:00.000Z');
 const pub=(await publish(fixed).expect(200)).body.data;await patch(pub,{onlineUrl:null}).expect(400);await patch(pub,{churchId:other.id}).expect(400);await patch(pub,{communityId:draftCommunity.id}).expect(409);
 const edited=(await patch(pub,{title:'Título nuevo'}).expect(200)).body.data;assert.equal(edited.publicationStatus,'published');assert.equal(edited.registrationInstructions,fixed.registrationInstructions);
 const online=(await create({modality:'online',location:null,onlineUrl:'https://example.test',participation:'invitation'}).expect(201)).body.data;await publish(online).expect(400);const invited=(await patch(online,{participationConditions:'Para personas invitadas por la comunidad.'}).expect(200)).body.data;await publish(invited).expect(200);
});
test('Concurrencia atómica compartida entre contenido, publicación y cancelación',async()=>{
 const e=(await create().expect(201)).body.data,url='/api/events/'+e._id;
 await request(app).patch(url).set(auth('rep')).send({title:'Otro'}).expect(428);await request(app).patch(url).set(auth('rep')).set('If-Match','1').send({title:'Otro'}).expect(400);await patch(e,{}).expect(400);
 const results=await Promise.all([patch(e,{title:'Cambio simultáneo'}),publish(e)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await patch(e,{title:'Obsoleto'}).expect(409);
 await request(app).patch(url+'/status').set(auth('rep')).set('If-Match','"1"').send({eventStatus:'cancelled',cancellationReason:'Cambio por lluvia'}).expect(409);
 await Church.updateOne({_id:church.id},{$pull:{representatives:users.rep._id}});await patch(e,{title:'Sin permiso'},'rep',2).expect(403);await Church.updateOne({_id:church.id},{$addToSet:{representatives:users.rep._id}});
});
test('Cancelado sigue público, no revela datos internos y puede reprogramarse explícitamente',async()=>{
 let e=(await create({contact:{email:'hidden@events.test',phone:'123',website:'https://example.test'},privateFields:{email:true,phone:true},communityId:community.id}).expect(201)).body.data;e=(await publish(e).expect(200)).body.data;
 const url='/api/events/'+e._id;await request(app).patch(url+'/status').set(auth('rep')).set('If-Match','"'+e.version+'"').send({eventStatus:'cancelled'}).expect(400);
 e=(await request(app).patch(url+'/status').set(auth('rep')).set('If-Match','"'+e.version+'"').send({eventStatus:'cancelled',cancellationReason:'Suspendido por lluvia.'}).expect(200)).body.data;assert.equal(e.publicationStatus,'published');
 const row=(await request(app).get(url).expect(200)).body.data;assert.equal(row.displayStatus,'cancelled');assert.equal(row.cancellationReason,'Suspendido por lluvia.');assert.equal(row.contact.email,undefined);assert.equal(row.contact.phone,undefined);assert.equal(row.organizer.type,'community');
 for(const k of ['createdBy','updatedBy','privateFields','version','__v','representatives','metadata'])assert.equal(row[k],undefined);
 const list=(await request(app).get('/api/events?communityId='+community.id).expect(200)).body;assert.ok(list.data.some(x=>x._id===e._id));
 e=(await request(app).patch(url+'/status').set(auth('rep')).set('If-Match','"'+e.version+'"').send({eventStatus:'scheduled'}).expect(200)).body.data;assert.equal(e.cancellationReason,'');
});
test('Visibilidad dinámica de iglesia y comunidad, archivo sin pérdida de datos',async()=>{
 let e=(await create({communityId:community.id}).expect(201)).body.data;e=(await publish(e).expect(200)).body.data;
 for(const status of ['draft','archived']){await Community.updateOne({_id:community.id},{$set:{status}});await request(app).get('/api/events/'+e._id).expect(404);assert.equal((await request(app).get('/api/events?communityId='+community.id+'&view=all').expect(200)).body.pagination.total,0);}
 await Community.updateOne({_id:community.id},{$set:{status:'published'}});
 for(const change of [{'metadata.dataStatus':'draft'},{'metadata.dataStatus':'published',active:false}]){await Church.updateOne({_id:church.id},{$set:change});await request(app).get('/api/events/'+e._id).expect(404);assert.equal((await request(app).get('/api/events?churchId='+church.id+'&view=all').expect(200)).body.pagination.total,0);const stored=await Event.findById(e._id);assert.equal(stored.publicationStatus,'published');assert.equal(stored.version,e.version);await request(app).get('/api/events/manage/'+e._id).set(auth('rep')).expect(200);}
 await Church.updateOne({_id:church.id},{$set:{active:true,'metadata.dataStatus':'published'}});await request(app).get('/api/events/'+e._id).expect(200);e=(await publish(e,'archived').expect(200)).body.data;await request(app).get('/api/events/'+e._id).expect(404);await publish(e,'draft').expect(200);
});
test('Filtros, límites de día UTC-3, paginación y eventos finalizados',async()=>{
 const a=(await create({title:'Filtro A',category:'workshop',audience:['Universitarios'],startsAt:'2098-12-31T23:30',location:{commune:'Providencia',address:'Lugar A'}}).expect(201)).body.data;await publish(a).expect(200);
 const b=(await create({title:'Filtro B',category:'workshop',audience:['Universitarios'],startsAt:'2099-01-01T00:00',location:{commune:'Providencia',address:'Lugar B'}}).expect(201)).body.data;await publish(b).expect(200);
 const query='/api/events?category=workshop&commune=providencia&audience=universitarios';let r=(await request(app).get(query+'&dateFrom=2098-12-31&dateTo=2098-12-31').expect(200)).body;assert.equal(r.pagination.total,1);assert.equal(r.data[0]._id,a._id);
 r=(await request(app).get(query+'&limit=1&page=2').expect(200)).body;assert.equal(r.pagination.total,2);assert.equal(r.data[0]._id,b._id);assert.equal(r.data[0].organizer.type,'church');
 for(const suffix of ['dateFrom=2099-01-02&dateTo=2099-01-01','dateFrom=2026-02-30','limit=0','page=1.5','churchId=invalid','publicationStatus=draft'])await request(app).get('/api/events?'+suffix).expect(400);
 let old=(await create({startsAt:'2000-01-01T23:00',endsAt:'2000-01-03T10:00'}).expect(201)).body.data;old=(await publish(old).expect(200)).body.data;assert.equal(old.displayStatus,'finished');const stored=await Event.findById(old._id);assert.equal(stored.eventStatus,'scheduled');
 assert.ok((await request(app).get('/api/events?view=past').expect(200)).body.data.some(e=>e._id===old._id));assert.ok(!(await request(app).get('/api/events').expect(200)).body.data.some(e=>e._id===old._id));
});

test('Búsqueda pública literal por título, longitud, paginación y privacidad',async()=>{
 const marker='[encuentro].*',make=body=>create({title:'Jornada '+marker,...body});
 const a=(await make({startsAt:'2099-11-01T10:00',category:'workshop'}).expect(201)).body.data;await publish(a).expect(200);
 const b=(await make({startsAt:'2099-11-02T10:00',communityId:community.id}).expect(201)).body.data;await publish(b).expect(200);
 await make({title:'Borrador '+marker}).expect(201);
 const archived=(await make({title:'Archivado '+marker}).expect(201)).body.data;await publish(archived,'archived').expect(200);
 const decoy=(await create({title:'Jornada encuentro distinta'}).expect(201)).body.data;await publish(decoy).expect(200);
 const url='/api/events?q='+encodeURIComponent('  [ENCUENTRO].*  ');let result=(await request(app).get(url+'&limit=1&page=2').expect(200)).body;
 assert.deepEqual(result.pagination,{page:2,limit:1,total:2,pages:2});assert.equal(result.data[0]._id,b._id);
 result=(await request(app).get(url+'&category=workshop').expect(200)).body;assert.equal(result.pagination.total,1);assert.equal(result.data[0]._id,a._id);
 try{
  await Community.updateOne({_id:community.id},{$set:{status:'draft'}});result=(await request(app).get(url).expect(200)).body;assert.equal(result.pagination.total,1);assert.equal(result.data[0]._id,a._id);
  await Church.updateOne({_id:church.id},{$set:{'metadata.dataStatus':'draft'}});result=(await request(app).get(url).expect(200)).body;assert.equal(result.pagination.total,0);assert.deepEqual(result.data,[]);
 }finally{await Community.updateOne({_id:community.id},{$set:{status:'published'}});await Church.updateOne({_id:church.id},{$set:{'metadata.dataStatus':'published'}});}
 for(const value of ['','   ','a'.repeat(201)])await request(app).get('/api/events?q='+encodeURIComponent(value)).expect(400);
 await request(app).get('/api/events?q='+encodeURIComponent('a'.repeat(200))).expect(200);
});
