const {test,before,after,beforeEach}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),request=require('supertest'),bcrypt=require('bcryptjs');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),User=require('../src/models/user.model'),Job=require('../src/models/mail-job.model'),q=require('../src/services/mail-queue.service'),security=require('../src/services/account-security.service'),{createApp}=require('../src/app');
const cfg={jwtSecret:'mail-queue-isolated-secret-longer-than-32',verificationPaused:true,corsOrigins:[],securityPolicy:{mailQueueEnabled:true},mail:{key:'fake',from:'test@example.test',appUrl:'https://example.test'},mailQueue:{activeKeyId:'test',keys:{test:Buffer.alloc(32,4).toString('base64')}}};let mongo,user,req;
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('mail_queue_isolated'));await Job.init();});
beforeEach(async()=>{await Promise.all([User.deleteMany({}),Job.deleteMany({}),require('../src/models/security-limit.model').deleteMany({})]);user=await User.create({email:'queue@example.test',password:await bcrypt.hash('Password-123',4),active:true});req={app:{locals:{config:cfg,mailFetch:()=>{throw Error('No real mail');}}}};});
after(async()=>{await disconnectDB();await mongo?.stop();});
test('Token/outbox atómico recuperable tras reinicio, privado, reconciliación idempotente',async()=>{
 assert.equal(await security.issue(req,user,'verify'),'queued');assert.equal(await Job.countDocuments(),0);
 const normal=await User.findById(user._id);assert.equal(normal.mailOutbox,undefined);const row=await User.findById(user._id).select('+mailOutbox +emailAction.hash');assert.equal(row.mailOutbox.length,1);assert.ok(row.emailAction.hash);assert.ok(!row.mailOutbox[0].payload.includes('queue@example.test'));
 await Promise.all([q.reconcile(),q.reconcile()]);assert.equal(await Job.countDocuments(),1);assert.equal((await User.findById(user._id).select('+mailOutbox')).mailOutbox.length,0);
 const old=row.mailOutbox[0];await User.updateOne({_id:user._id},{$push:{mailOutbox:old}});await q.reconcile();assert.equal(await Job.countDocuments(),1);
});
test('Workers concurrentes, lease recuperable y timeout posterior a aceptación conserva idempotencia',async()=>{
 await security.issue(req,user,'verify');await q.reconcile();let calls=0;await Promise.all([1,2,3].map(()=>q.runOne(cfg,{send:async()=>{calls++;return {ok:true};}})));assert.equal(calls,1);
 let job=await Job.findOne();assert.equal(job.state,'accepted');assert.equal((await Job.findById(job.id).select('+payload')).payload,undefined);
 await User.updateOne({_id:user._id},{$unset:{emailAction:1}});await security.issue(req,user,'verify');await q.reconcile();job=await Job.findOne({state:'pending'});
 await Job.updateOne({_id:job.id},{$set:{state:'processing',owner:'crashed-worker',leaseUntil:new Date(0)}});const ids=[];
 await q.runOne(cfg,{send:async(c,d,id)=>{ids.push(id);throw Error('accepted but response lost');}});assert.equal((await Job.findById(job.id)).state,'retry');assert.ok((await User.findById(user._id).select('+emailAction.hash')).emailAction.hash);
 await Job.updateOne({_id:job.id},{$set:{nextAttemptAt:new Date(0)}});await q.runOne(cfg,{send:async(c,d,id)=>{ids.push(id);return {ok:true};}});assert.equal(ids[0],ids[1]);
});
test('Reenvío, consumo y vencimiento anulan trabajos sin enviar',async()=>{
 await security.issue(req,user,'verify');await q.reconcile();await User.updateOne({_id:user._id},{$set:{'emailAction.requestedAt':new Date(0)}});await security.issue(req,user,'verify');await q.reconcile();let calls=0;const send=async()=>{calls++;return {ok:true};};await q.runOne(cfg,{send});assert.equal(calls,0);assert.equal(await Job.countDocuments({state:'obsolete'}),1);
 await User.updateOne({_id:user._id},{$unset:{emailAction:1}});await q.runOne(cfg,{send});assert.equal(calls,0);
 await Job.create({_id:'expired',state:'pending',nextAttemptAt:new Date(0),expiresAt:new Date(0)});await q.runOne(cfg,{send});assert.equal(calls,0);
});
test('Permanentes, máximo intentos, Retry-After y modo desactivado',async()=>{
 await security.issue(req,user,'invite');await q.reconcile();let job=await Job.findOne();assert.equal(await q.runOne({...cfg,securityPolicy:{mailQueueEnabled:false}}),false);assert.equal((await Job.findById(job.id)).state,'pending');
 await q.runOne(cfg,{send:async()=>({ok:false,temporary:true,reason:'provider_rate_limit',delay:120000}),random:()=>0});job=await Job.findById(job.id);assert.ok(job.nextAttemptAt.getTime()>Date.now()+110000);
 await Job.updateOne({_id:job.id},{$set:{attempts:5,nextAttemptAt:new Date(0)}});await q.runOne(cfg,{send:async()=>({ok:false,temporary:true,reason:'network_or_timeout'})});assert.equal((await Job.findById(job.id)).state,'failed');
 assert.equal(q.retryAfter('12'),12000);assert.equal(q.retryAfter(new Date(Date.now()+120000).toUTCString())>118000,true);
 const mock=async()=>({ok:false,status:422,headers:{get:()=>null},json:async()=>({})});const result=await q.deliver(cfg,{email:'test@example.test'},'key',mock);assert.equal(result.temporary,false);
});
test('Recuperación genérica en cola y aviso de contraseña persistido sin envío',async()=>{
 const app=createApp(cfg);app.locals.mailFetch=()=>{throw Error('must not send');};
 const a=await request(app).post('/api/auth/forgot-password').send({email:user.email}).expect(200),b=await request(app).post('/api/auth/forgot-password').send({email:'unknown@example.test'}).expect(200);assert.equal(a.body.message,b.body.message);assert.match(a.body.message,/cola/);
 const row=await User.findById(user.id).select('+mailOutbox'),item=row.mailOutbox[0],payload=q.open(item.payload,item.id,cfg),token=payload.text.match(/token=([a-f0-9]+)/)[1];
 await request(app).post('/api/auth/reset-password').send({token,newPassword:'Another-password-123'}).expect(200);const after=await User.findById(user.id).select('+password +mailOutbox');assert.ok(await bcrypt.compare('Another-password-123',after.password));assert.equal(after.mailOutbox.length,2);
 await q.reconcile();await q.runOne(cfg,{send:async()=>{throw Error('temporary');}});await q.runOne(cfg,{send:async()=>{throw Error('temporary');}});assert.ok(await bcrypt.compare('Another-password-123',(await User.findById(user.id).select('+password')).password));
});
test('Un worker que perdió el lease no sobrescribe al nuevo propietario',async()=>{
 await security.issue(req,user,'verify');await q.reconcile();let release,entered;const started=new Promise(r=>{entered=r;});
 const old=q.runOne(cfg,{send:async()=>{entered();return new Promise(r=>{release=r;});}});await started;
 await Job.updateOne({state:'processing'},{$set:{leaseUntil:new Date(0)}});await q.runOne(cfg,{send:async()=>({ok:true})});release({ok:false,temporary:false,reason:'provider_rejected'});await old;assert.equal((await Job.findOne()).state,'accepted');
});
test('Registro estricto informa cola; cambio autenticado conserva aviso atómico',async()=>{
 const strict=createApp({...cfg,verificationPaused:false});const registered=await request(strict).post('/api/auth/register').send({email:'new@example.test',password:'Password-123'}).expect(202);assert.match(registered.body.message,/cola/);
 const app=createApp(cfg),login=await request(app).post('/api/auth/login').send({email:user.email,password:'Password-123'}).expect(200);
 await request(app).post('/api/auth/change-password').set('Authorization','Bearer '+login.body.token).send({currentPassword:'Password-123',newPassword:'Changed-password-123'}).expect(200);
 const row=await User.findById(user.id).select('+mailOutbox +password');assert.equal(row.mailOutbox.length,1);assert.ok(await bcrypt.compare('Changed-password-123',row.password));
});
