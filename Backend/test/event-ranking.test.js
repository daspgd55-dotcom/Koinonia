const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),request=require('supertest'),jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model'),Church=require('../src/models/church.model'),Event=require('../src/models/event.model'),Follow=require('../src/models/church-follow.model'),View=require('../src/models/event-view.model'),Participation=require('../src/models/event-participation.model');
const secret='isolated-event-ranking-secret-longer-than-32',app=createApp({requireVerifiedEmail:false,jwtSecret:secret,corsOrigins:[]}),users=[],churches=[],events=[];let mongo;
const auth=i=>({Authorization:'Bearer '+jwt.sign({sv:0},secret,{subject:users[i].id,issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'})});
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('ranking_isolated'));
 for(let i=0;i<5;i++)users.push(await User.create({email:`ranking${i}@example.test`,password:'isolated-unused-hash',role:'user'}));
 for(let i=0;i<4;i++)churches.push(await Church.create({identification:{name:'Ranking iglesia '+i},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70,-33]}},metadata:{dataStatus:'published',firstPublishedByAdminAt:new Date()},createdBy:users[0].id}));
 await User.updateOne({_id:users[0].id},{$set:{membershipChurch:churches[0].id}});
 for(const [i,church] of [[0,1],[1,2],[2,2],[3,2]])await Follow.create({user:users[i].id,church:churches[church].id,active:true,since:new Date()});
 for(const [i,church] of [0,1,2,3,3,3].entries())events.push(await Event.create({churchId:churches[church].id,title:'Ranking evento '+i,startsAt:new Date('2099-01-01'),effectiveEndsAt:new Date('2099-01-02'),publicationStatus:'published',createdBy:users[0].id,updatedBy:users[0].id}));
 await View.create({user:users[1].id,event:events[3].id});for(let i=1;i<5;i++)await Participation.create({user:users[i].id,event:events[4].id,status:'interested',since:new Date()});
});
after(async()=>{await disconnectDB();await mongo?.stop();});
test('Orden lexicográfico: pertenencia, seguimiento, seguidores, vistas e interés antes de paginar',async()=>{
 const r=await request(app).get('/api/events?sort=recommended').set(auth(0)).expect(200);assert.deepEqual(r.body.data.map(e=>e._id),events.map(e=>e.id));
 const page=await request(app).get('/api/events?sort=recommended&limit=2&page=2').set(auth(0)).expect(200);assert.deepEqual(page.body.data.map(e=>e._id),[events[2].id,events[3].id]);assert.equal(page.body.pagination.total,6);
 const guest=await request(app).get('/api/events?sort=recommended').expect(200);assert.deepEqual(guest.body.data.slice(0,4).map(e=>e._id),[events[2].id,events[1].id,events[3].id,events[4].id]);
 for(const result of [r,guest]){assert.equal(result.headers['cache-control'],'no-store');const json=JSON.stringify(result.body);for(const secret of ['rankViewCount','rankOwn','rankFollowers',users[0].email,'readNotices'])assert.ok(!json.includes(secret));}
 await request(app).get('/api/events?sort=recommended&userId='+users[0].id).expect(400);await request(app).get('/api/events?sort=recommended').set('Authorization','Bearer invalid').expect(401);
});
test('Visualizaciones únicas, privadas y autenticadas, sin aceptar conteos del cliente',async()=>{
 const url='/api/events/'+events[5].id+'/view';await request(app).post(url).send({}).expect(401);
 await Promise.all(Array.from({length:8},()=>request(app).post(url).set(auth(0)).send({}).expect(200)));assert.equal(await View.countDocuments({event:events[5].id,user:users[0].id}),1);
 await request(app).post(url).set(auth(0)).send({views:1000}).expect(400);await request(app).post(url).set(auth(1)).send({}).expect(200);assert.equal(await View.countDocuments({event:events[5].id}),2);
 await Event.updateOne({_id:events[5].id},{$set:{publicationStatus:'draft'}});await request(app).post(url).set(auth(2)).send({}).expect(404);const r=await request(app).get('/api/events?sort=recommended').set(auth(0)).expect(200);assert.ok(!r.body.data.some(e=>e._id===events[5].id));
 await Church.updateOne({_id:churches[0].id},{$set:{'metadata.dataStatus':'draft'}});assert.ok(!(await request(app).get('/api/events?sort=recommended').set(auth(0)).expect(200)).body.data.some(e=>e._id===events[0].id));
});
test('Inscripción requerida permite interés pero rechaza intención de asistencia directa',async()=>{
 const e=events[4],url='/api/events/'+e.id+'/participation';await Event.updateOne({_id:e.id},{$set:{participation:'registration'}});
 await request(app).put(url).set(auth(0)).send({status:'going'}).expect(409);await request(app).put(url).set(auth(0)).send({status:'interested'}).expect(200);await request(app).put(url).set(auth(0)).send({status:'withdrawn'}).expect(200);
});
test('Cancelados y finalizados no desplazan próximos; conserva orden cronológico alternativo',async()=>{
 await Event.updateOne({_id:events[1].id},{$set:{eventStatus:'cancelled',cancellationReason:'Prueba aislada'}});
 await Event.updateOne({_id:events[2].id},{$set:{startsAt:new Date(Date.now()-86400000),effectiveEndsAt:new Date(Date.now()-3600000)}});
 const ranked=await request(app).get('/api/events?sort=recommended&view=all').set(auth(0)).expect(200);
 assert.deepEqual(ranked.body.data.map(e=>e._id),[events[3].id,events[4].id,events[1].id,events[2].id]);
 const dated=await request(app).get('/api/events?sort=date&view=upcoming').expect(200);assert.equal(dated.body.data.length,3);
});

test('Total público de interés sin asistentes ni identidades; ocultos no disponibles',async()=>{
 const r=await request(app).get('/api/events/'+events[4].id+'/interest-count').expect(200);assert.deepEqual(r.body,{data:{interested:4}});assert.equal(r.headers['cache-control'],'no-store');
 await request(app).get('/api/events/'+events[5].id+'/interest-count').expect(404);await request(app).get('/api/events/'+events[0].id+'/interest-count').expect(404);
 const url='/api/events/'+events[3].id+'/participation';await request(app).put(url).set(auth(0)).send({status:'interested'}).expect(200);assert.equal((await request(app).get('/api/events/'+events[3].id+'/interest-count')).body.data.interested,1);
 await request(app).put(url).set(auth(0)).send({status:'going'}).expect(200);assert.equal((await request(app).get('/api/events/'+events[3].id+'/interest-count')).body.data.interested,0);
});
