const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto'),request=require('supertest'),jwt=require('jsonwebtoken'),{MongoMemoryServer}=require('mongodb-memory-server');
const {connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model'),Friend=require('../src/models/friendship.model'),Message=require('../src/models/message.model'),Church=require('../src/models/church.model'),Event=require('../src/models/event.model');
const secret='social-isolated-test-secret-more-than-32-chars',app=createApp({requireVerifiedEmail:false,jwtSecret:secret,corsOrigins:[]}),users=[];let mongo,church,event;
const auth=i=>({Authorization:'Bearer '+jwt.sign({sv:0},secret,{subject:users[i].id,issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'})});
async function connect(a,b){const r=await request(app).post('/api/friends').set(auth(a)).send({userId:users[b].id}).expect(200),id=r.body.data.id;const f=await Friend.findById(id);if(f.status==='pending')await request(app).patch('/api/friends/'+id).set(auth(b)).send({action:'accept',revision:f.revision}).expect(200);return id;}
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('social_isolated'));for(let i=0;i<8;i++)users.push(await User.create({name:'Persona '+i,username:'social_'+i,email:`social${i}@example.test`,password:'not-a-login-hash',role:i===7?'admin':'user'}));church=await Church.create({identification:{name:'Iglesia social'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'published',firstPublishedByAdminAt:new Date()},createdBy:users[0].id});event=await Event.create({churchId:church.id,title:'Evento social',startsAt:new Date('2099-01-01'),effectiveEndsAt:new Date('2099-01-02'),publicationStatus:'published',createdBy:users[0].id,updatedBy:users[0].id});});
after(async()=>{await disconnectDB();await mongo?.stop();});
test('Nombre disponible, normalización, reglas y registro concurrente sin duplicados',async()=>{
 assert.equal((await request(app).get('/api/usernames/availability?username=SOCIAL_0').expect(200)).body.data.available,false);
 await request(app).get('/api/usernames/availability?username=admin').expect(400);await request(app).get('/api/usernames/availability?username=bad.name').expect(400);
 const r=await Promise.all([1,2].map(i=>request(app).post('/api/auth/register').send({username:'new_unique',email:`new${i}@example.test`,password:'Test-only-12345'})));assert.deepEqual(r.map(x=>x.status).sort(),[201,409]);assert.equal(await User.countDocuments({username:'new_unique'}),1);assert.equal(r.find(x=>x.status===409).body.error.code,'USERNAME_TAKEN');
});
test('Búsqueda autenticada mínima, solicitudes recíprocas y autorización de aceptación',async()=>{
 await request(app).get('/api/friends/search?q=social').expect(401);await request(app).get('/api/friends/search?q=so').set(auth(0)).expect(400);
 const r=await request(app).get('/api/friends/search?q=social_1').set(auth(0)).expect(200);assert.deepEqual(Object.keys(r.body.data[0]).sort(),['avatarUrl','id','name','username']);assert.ok(!JSON.stringify(r.body).includes('@example.test'));
 await request(app).post('/api/friends').set(auth(0)).send({userId:users[0].id}).expect(400);
 const requests=await Promise.all([request(app).post('/api/friends').set(auth(0)).send({userId:users[1].id}),request(app).post('/api/friends').set(auth(1)).send({userId:users[0].id})]);assert.ok(requests.every(r=>r.status===200));assert.equal(requests[0].body.data.id,requests[1].body.data.id);
 const f=await Friend.findById(requests[0].body.data.id),sender=String(f.requestedBy)===users[0].id?0:1,recipient=1-sender;
 await request(app).patch('/api/friends/'+f.id).set(auth(sender)).send({action:'accept',revision:f.revision}).expect(409);await request(app).patch('/api/friends/'+f.id).set(auth(7)).send({action:'accept',revision:f.revision}).expect(404);
 await request(app).post('/api/friends/'+f.id+'/messages').set(auth(sender)).send({clientId:randomUUID(),text:'No permitido'}).expect(403);
 const results=await Promise.all(['accept','reject'].map(action=>request(app).patch('/api/friends/'+f.id).set(auth(recipient)).send({action,revision:f.revision})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
test('Mensajes idempotentes, lectura privada y paginación; ni admin lee conversaciones ajenas',async()=>{
 const id=await connect(2,3),url='/api/friends/'+id,body={clientId:randomUUID(),text:'Hola <script>no se ejecuta</script>'};
 await Promise.all(Array.from({length:5},()=>request(app).post(url+'/messages').set(auth(2)).send(body).expect(200)));assert.equal(await Message.countDocuments({friendship:id}),1);
 await request(app).post(url+'/messages').set(auth(2)).send({...body,text:'Otro texto'}).expect(409);
 for(const i of [0,7]){await request(app).get(url+'/messages').set(auth(i)).expect(404);await request(app).post(url+'/read').set(auth(i)).send({sequence:1}).expect(404);}
 const summary=await request(app).get('/api/friends/summary').set(auth(3)).expect(200);assert.equal(summary.body.data.unread,1);
 const messages=(await request(app).get(url+'/messages').set(auth(3)).expect(200)).body;assert.equal(messages.data[0].mine,false);await request(app).post(url+'/read').set(auth(2)).send({sequence:messages.data[0].sequence}).expect(200);assert.equal((await request(app).get('/api/friends/summary').set(auth(3))).body.data.unread,1);
 await request(app).post(url+'/read').set(auth(3)).send({sequence:messages.data[0].sequence}).expect(200);assert.equal((await request(app).get('/api/friends/summary').set(auth(3))).body.data.unread,0);
 const f=await Friend.findById(id);await Message.insertMany(Array.from({length:52},(_,i)=>({friendship:id,sender:users[2].id,recipient:users[3].id,sequence:f.sequence+i+1,clientId:randomUUID(),text:'Historial '+i})));await Friend.updateOne({_id:id},{$inc:{sequence:52}});
 const first=(await request(app).get(url+'/messages').set(auth(3))).body;assert.equal(first.data.length,50);const older=(await request(app).get(url+'/messages?before='+first.nextBefore).set(auth(3))).body;assert.equal(older.data.length,3);
});
test('Compartir recursos públicos y ocultarlos dinámicamente, bloqueo y retiro sin perder historial',async()=>{
 const id=await connect(4,5),url='/api/friends/'+id;for(const [type,r] of [['church',church],['event',event]])await request(app).post(url+'/messages').set(auth(4)).send({clientId:randomUUID(),resource:{type,id:r.id}}).expect(200);
 assert.equal((await request(app).get(url+'/messages').set(auth(5))).body.data.filter(m=>m.resource).length,2);
 await Church.updateOne({_id:church.id},{$set:{'metadata.dataStatus':'draft'}});const hidden=(await request(app).get(url+'/messages').set(auth(5))).body;assert.ok(hidden.data.every(m=>m.resourceUnavailable&&!m.resource));assert.ok(!JSON.stringify(hidden).includes('Evento social'));
 await request(app).post(url+'/messages').set(auth(4)).send({clientId:randomUUID(),resource:{type:'event',id:event.id}}).expect(404);
 let f=await Friend.findById(id);await request(app).patch(url).set(auth(5)).send({action:'block',revision:f.revision}).expect(200);
 await request(app).post(url+'/messages').set(auth(4)).send({clientId:randomUUID(),text:'No'}).expect(403);await request(app).post('/api/friends').set(auth(4)).send({userId:users[5].id}).expect(404);
 assert.equal((await request(app).get('/api/friends/search?q=social_5').set(auth(4))).body.data.length,0);assert.equal((await request(app).get(url+'/messages').set(auth(5))).body.data.length,2);
 f=await Friend.findById(id);await request(app).patch(url).set(auth(4)).send({action:'unblock',revision:f.revision}).expect(409);await request(app).patch(url).set(auth(5)).send({action:'unblock',revision:f.revision}).expect(200);assert.equal((await Friend.findById(id)).status,'removed');
});
test('Límite persistente de envíos y cuerpos estrictos',async()=>{
 const id=await connect(6,7),url='/api/friends/'+id+'/messages';await request(app).post(url).set(auth(6)).send({clientId:randomUUID(),text:'x',sender:users[0].id}).expect(400);await request(app).post(url).set(auth(6)).send({clientId:randomUUID(),text:' '.repeat(10)}).expect(400);
 const results=await Promise.all(Array.from({length:31},()=>request(app).post(url).set(auth(6)).send({clientId:randomUUID(),text:'Prueba de límite'})));assert.ok(results.some(r=>r.status===429));assert.ok(results.filter(r=>r.status===200).length<=28);
});
