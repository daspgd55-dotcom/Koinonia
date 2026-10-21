const {test,before,after,beforeEach}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),request=require('supertest'),{Webhook}=require('svix'),jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model'),Job=require('../src/models/mail-job.model'),Event=require('../src/models/mail-event.model'),queue=require('../src/services/mail-queue.service');
const cfg={jwtSecret:'mail-observe-isolated-secret-longer-than-32',verificationPaused:true,corsOrigins:[],mailWebhookSecret:'whsec_'+Buffer.alloc(32,8).toString('base64'),mailWebhookSource:'simulated',securityPolicy:{mailQueueEnabled:true},mail:{key:'fake',from:'test@example.test',appUrl:'https://example.test'},mailQueue:{activeKeyId:'test',keys:{test:Buffer.alloc(32,4).toString('base64')}}};let mongo,app,admin,rep,normal;
function token(user){return jwt.sign({sv:0},cfg.jwtSecret,{subject:String(user._id),issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'});}
function postEvent(type,id='event-1',extra={},date=new Date()){
 const body=JSON.stringify({type,created_at:date.toISOString(),data:{email_id:'provider-1',to:['secret@example.test'],subject:'private token=SECRET',...extra}},null,2),timestamp=new Date();
 return request(app).post('/api/webhooks/resend').set('Content-Type','application/json').set('svix-id',id).set('svix-timestamp',String(Math.floor(timestamp.getTime()/1000))).set('svix-signature',new Webhook(cfg.mailWebhookSecret).sign(id,timestamp,body)).send(body);
}
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('mail_observe_isolated'));await Event.init();});
beforeEach(async()=>{await Promise.all([User.deleteMany({}),Job.deleteMany({}),Event.deleteMany({}),require('../src/models/security-limit.model').deleteMany({})]);app=createApp(cfg);admin=await User.create({email:'admin@example.test',password:'unused',role:'admin'});rep=await User.create({email:'rep@example.test',password:'unused',role:'representative'});normal=await User.create({email:'normal@example.test',password:'unused'});});
after(async()=>{await disconnectDB();await mongo?.stop();});
test('Firma original válida, inválida, expirada y ausencia de seguimiento',async()=>{
 await request(app).post('/api/webhooks/resend').send({type:'email.delivered'}).expect(400);
 await postEvent('email.delivered').expect(204);await postEvent('email.opened','ignored').expect(204);assert.equal(await Event.countDocuments(),1);
 const body='{}',date=new Date(Date.now()-600000);await request(app).post('/api/webhooks/resend').set('Content-Type','application/json').set('svix-id','old').set('svix-timestamp',String(Math.floor(date.getTime()/1000))).set('svix-signature',new Webhook(cfg.mailWebhookSecret).sign('old',date,body)).send(body).expect(400);
 const fresh=new Date();await request(app).post('/api/webhooks/resend').set('Content-Type','application/json').set('svix-id','tampered').set('svix-timestamp',String(Math.floor(fresh.getTime()/1000))).set('svix-signature',new Webhook(cfg.mailWebhookSecret).sign('tampered',fresh,body)).send(body+' ').expect(400);
 assert.ok(!JSON.stringify(await Event.find().lean()).includes('SECRET'));assert.ok(!JSON.stringify(await Event.find().lean()).includes('secret@example'));
});
test('Duplicados concurrentes y desorden preservan evidencia, asociación tardía',async()=>{
 await Promise.all([postEvent('email.delivered','delivered'),postEvent('email.delivered','delivered')]);assert.equal(await Event.countDocuments(),1);
 await postEvent('email.delivery_delayed','delayed',{},new Date(Date.now()-60000)).expect(204);await postEvent('email.sent','sent',{},new Date(Date.now()-120000)).expect(204);
 await Job.create({_id:'message',state:'accepted',source:'simulated',providerId:'provider-1'});
 let result=await request(app).get('/api/security/mail').set('Authorization','Bearer '+token(admin)).expect(200);assert.equal(result.body.data[0].providerStatus,'email.delivered');
 await postEvent('email.complained','complaint').expect(204);await postEvent('email.delivered','again').expect(204);result=await request(app).get('/api/security/mail').set('Authorization','Bearer '+token(admin));assert.equal(result.body.data[0].providerStatus,'email.complained');
 const uuid=require('node:crypto').randomUUID();await Job.create({_id:uuid,state:'direct_pending'});await postEvent('email.sent','tag',{tags:{koinonia_message:uuid}}).expect(204);assert.equal((await Job.findById(uuid)).providerId,'provider-1');
});
test('Solo admin, minimización, métricas y datos simulados',async()=>{
 await request(app).get('/api/security/mail').expect(401);for(const user of [rep,normal]){await request(app).get('/api/security/mail').set('Authorization','Bearer '+token(user)).expect(403);await request(app).post('/api/security/mail/any/retry').set('Authorization','Bearer '+token(user)).expect(403);}
 await Job.create({_id:'private',payload:'secret-ciphertext',state:'failed',source:'simulated',attempts:3,failure:'provider_rejected'});await postEvent('email.bounced').expect(204);
 const r=await request(app).get('/api/security/mail').set('Authorization','Bearer '+token(admin)).expect(200);assert.ok(!JSON.stringify(r.body).includes('secret-ciphertext'));assert.equal(r.body.data[0].canRetry,false);assert.equal(r.body.metrics.volumes[0].retries,2);assert.equal(r.body.metrics.eventVolumes[0]._id.source,'simulated');assert.equal(r.headers['cache-control'],'no-store');
});
test('Reintentos elegibles con auditoría atómica; vencidos, reemplazados y espera no reviven',async()=>{
 const expiresAt=new Date(Date.now()+600000),guard={user:String(normal._id),field:'emailAction',hash:'current',expiresAt};await User.updateOne({_id:normal._id},{$set:{emailAction:{hash:'current',purpose:'verify',expiresAt}}});
 const item=queue.entry(cfg,normal.email,'private','token=SECRET',guard);await Job.create({_id:item.id,payload:item.payload,expiresAt,state:'retry',nextAttemptAt:new Date(0),attempts:1});
 const results=await Promise.all([1,2].map(()=>request(app).post('/api/security/mail/'+item.id+'/retry').set('Authorization','Bearer '+token(admin))));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);let job=await Job.findById(item.id).select('+audit');assert.equal(job.audit.length,1);assert.equal(String(job.audit[0].actor),String(admin._id));
 await Job.updateOne({_id:item.id},{$set:{lastManualRetryAt:new Date(0),nextAttemptAt:new Date(Date.now()+600000)}});await request(app).post('/api/security/mail/'+item.id+'/retry').set('Authorization','Bearer '+token(admin)).expect(409);
 await Job.updateOne({_id:item.id},{$set:{nextAttemptAt:new Date(0)}});await User.updateOne({_id:normal._id},{$unset:{emailAction:1}});await request(app).post('/api/security/mail/'+item.id+'/retry').set('Authorization','Bearer '+token(admin)).expect(409);
 await Job.updateOne({_id:item.id},{$set:{expiresAt:new Date(0)}});await request(app).post('/api/security/mail/'+item.id+'/retry').set('Authorization','Bearer '+token(admin)).expect(409);
});
test('Webhook recupera aceptación tras timeout y evita otro envío; reintento de webhook persiste',async()=>{
 const item=queue.notice(cfg,normal.email);await Job.create({_id:item.id,payload:item.payload,expiresAt:item.expiresAt,state:'retry',nextAttemptAt:new Date(0),attempts:1});
 const original=Event.updateOne;try{Event.updateOne=async()=>{throw Error('storage unavailable');};await postEvent('email.sent','retry-webhook',{tags:{koinonia_message:item.id}}).expect(500);}finally{Event.updateOne=original;}
 await postEvent('email.sent','retry-webhook',{tags:{koinonia_message:item.id}}).expect(204);let sends=0;await queue.runOne(cfg,{send:async()=>{sends++;return {ok:true};}});assert.equal(sends,0);assert.equal((await Job.findById(item.id)).state,'accepted');
});
test('Límite de solicitudes administrativas no habilita reenvíos definitivos',async()=>{
 await Job.create({_id:'permanent',state:'failed',attempts:6,failure:'provider_rejected'});
 for(let i=0;i<10;i++)await request(app).post('/api/security/mail/permanent/retry').set('Authorization','Bearer '+token(admin)).expect(409);
 await request(app).post('/api/security/mail/permanent/retry').set('Authorization','Bearer '+token(admin)).expect(429);assert.equal((await Job.findById('permanent')).state,'failed');
});
