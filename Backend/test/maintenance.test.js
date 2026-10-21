const {test,before,after,beforeEach}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),request=require('supertest'),jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),User=require('../src/models/user.model'),Mfa=require('../src/models/mfa.model'),Limit=require('../src/models/security-limit.model'),Risk=require('../src/models/abuse-counter.model'),Captcha=require('../src/models/captcha-use.model'),Job=require('../src/models/mail-job.model'),Event=require('../src/models/mail-event.model'),Church=require('../src/models/church.model'),{Lock,Run}=require('../src/models/maintenance.model'),maintenance=require('../src/services/maintenance.service'),retention=require('../src/config/retention'),{createApp}=require('../src/app');
const cfg={jwtSecret:'maintenance-isolated-secret-longer-than-32',verificationPaused:true,corsOrigins:[],securityPolicy:{cleanupMode:'apply'},retention:{...retention.defaults,batchSize:2},mail:{key:'test',from:'test@example.test',appUrl:'https://example.test'}};let mongo;
const old=()=>new Date(Date.now()-10*86400000),future=()=>new Date(Date.now()+3600000),token=u=>jwt.sign({sv:0},cfg.jwtSecret,{subject:String(u._id),issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'});
before(async()=>{mongo=await MongoMemoryServer.create({instance:{args:['--setParameter','ttlMonitorEnabled=false']},binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('maintenance_isolated'));await Run.init();});
beforeEach(async()=>{for(const model of [User,Mfa,Limit,Risk,Captcha,Job,Event,Church,Lock,Run])await model.deleteMany({});});
after(async()=>{await disconnectDB();await mongo?.stop();});
async function users(){const result=[];for(const role of ['admin','representative','user'])result.push(await User.create({email:role+'@example.test',password:'private-password',role,emailAction:{hash:'SECRET-hash',purpose:role==='representative'?'invite':'verify',expiresAt:old()},invitationPending:role==='representative'}));return result;}
test('Simulación solo conteos; aplicación separa artefactos y nunca borra cuentas/asignaciones',async()=>{
 const accounts=await users();await Church.create({createdBy:accounts[0]._id,identification:{name:'Iglesia aislada'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.6,-33.4]}},representatives:[accounts[1]._id,accounts[2]._id]});
 await User.updateOne({_id:accounts[2]._id},{$set:{passwordReset:{hash:'SECRET-reset',expiresAt:old()}}});
 await Mfa.create({user:accounts[0]._id,active:true,secret:'SECRET-active',recoveryHashes:['SECRET-recovery'],pendingSecret:'SECRET-pending',pendingUntil:old(),challengeHash:'SECRET-challenge',challengeUntil:old()});
 for(const Model of [Limit,Risk,Captcha]){await Model.create({_id:'expired',count:1,expiresAt:old(),purgeAt:old()});await Model.create({_id:'valid',count:1,expiresAt:future(),purgeAt:future()});}
 await Job.collection.insertMany([{_id:'terminal',state:'failed',createdAt:old(),updatedAt:old(),purgeAt:old()},{_id:'active',state:'processing',createdAt:old(),updatedAt:old(),purgeAt:old(),leaseUntil:future()}]);await Event.create({_id:'event',providerId:'provider',type:'email.sent',createdAt:old(),purgeAt:old()});
 const preview=await maintenance.run(cfg);assert.equal(preview.accounts.eligibleForDeletion,0);assert.equal(preview.accounts.protected,3);assert.equal(preview.categories.email_tokens.eligible,3);assert.ok(!JSON.stringify(preview).includes('SECRET'));assert.equal((await User.findById(accounts[0]._id).select('+emailAction.hash')).emailAction.hash,'SECRET-hash');
 const applied=await maintenance.run(cfg,{mode:'apply'});assert.equal(applied.accountsDeleted,0);assert.equal(await User.countDocuments(),3);assert.equal((await Church.findOne()).representatives.length,2);assert.equal((await User.findById(accounts[1]._id)).invitationPending,true);assert.equal((await User.findById(accounts[0]._id)).emailVerifiedAt,null);
 const mfa=await Mfa.findOne().select('+secret +pendingSecret +challengeHash +recoveryHashes');assert.equal(mfa.secret,'SECRET-active');assert.equal(mfa.pendingSecret,undefined);assert.equal(mfa.challengeHash,undefined);assert.equal(mfa.recoveryHashes.length,1);
 for(const Model of [Limit,Risk,Captcha])assert.equal(await Model.countDocuments(),1);assert.equal(await Job.countDocuments(),1);assert.equal((await Job.findOne()).id,'active');assert.equal(await Event.countDocuments(),0);
});
test('Límites, renovación entre simulación y aplicación y recuperación de interrupciones',async()=>{
 const a=(await users())[0];await maintenance.run(cfg);await User.updateOne({_id:a.id},{$set:{'emailAction.hash':'new','emailAction.expiresAt':future()}});
 await assert.rejects(maintenance.run({...cfg,securityPolicy:{cleanupMode:'off'}},{mode:'apply'}),/DISABLED/);
 await assert.rejects(maintenance.run(cfg,{mode:'apply',afterBatch:()=>{throw Error('simulated crash');}}),/INTERRUPTED/);assert.equal((await Run.findOne({state:'interrupted'})).batch.state,'started');await maintenance.run(cfg,{mode:'apply'});assert.equal((await User.findById(a.id).select('+emailAction.hash')).emailAction.hash,'new');assert.equal(await User.countDocuments(),3);
 await Lock.updateOne({_id:'security'},{$set:{owner:'another',leaseUntil:future()}});assert.deepEqual(await maintenance.run(cfg),{state:'busy'});await Lock.updateOne({_id:'security'},{$set:{leaseUntil:old()}});assert.equal((await maintenance.run(cfg)).state,'completed');
 assert.throws(()=>retention.load({SECURITY_MAIL_RETENTION_DAYS:'0'}));assert.throws(()=>retention.load({SECURITY_ACCOUNT_DELETION_ENABLED:'true'}));
});
test('Invitación vencida se revisa/reenvía/revoca sin borrar asignaciones; no acepta token expirado antes de limpieza',async()=>{
 const [admin,rep,normal]=await users(),app=createApp(cfg);let mail;app.locals.mailFetch=async(url,options)=>{mail=JSON.parse(options.body);return {ok:true};};const church=await Church.create({createdBy:admin._id,identification:{name:'Asignación preservada'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70,-33]}},representatives:[rep.id]});
 await User.updateOne({_id:rep.id},{$set:{'emailAction.hash':require('../src/services/account-security.service').hash('a'.repeat(64))}});
 await request(app).post('/api/auth/accept-invitation').send({token:'a'.repeat(64),newPassword:'Password-123'}).expect(400);
 await request(app).get('/api/security/invitations').set('Authorization','Bearer '+token(normal)).expect(403);const list=await request(app).get('/api/security/invitations').set('Authorization','Bearer '+token(admin)).expect(200);assert.equal(list.body.data[0].status,'expired');assert.equal(list.body.data[0].assignments,1);assert.ok(!JSON.stringify(list.body).includes('SECRET'));
 await request(app).post('/api/security/invitations/'+rep.id).set('Authorization','Bearer '+token(admin)).send({action:'resend'}).expect(200);const link=mail.text.match(/token=([a-f0-9]+)/)[1];
 await request(app).post('/api/security/invitations/'+rep.id).set('Authorization','Bearer '+token(admin)).send({action:'revoke'}).expect(200);await request(app).post('/api/auth/accept-invitation').send({token:link,newPassword:'Password-123'}).expect(400);
 mail=null;await request(app).post('/api/auth/resend-verification').send({email:rep.email}).expect(200);assert.equal(mail,null);assert.equal((await Church.findById(church.id)).representatives.length,1);assert.equal((await User.findById(rep.id)).invitationPending,true);
});
test('Migración de TTL conserva registros y excluye trabajos activos',async()=>{
 const indexes=await Job.collection.indexes(),ttl=indexes.find(i=>i.key.purgeAt);assert.deepEqual(ttl.partialFilterExpression.state.$in,['accepted','failed','obsolete']);await Job.collection.dropIndex(ttl.name);await Job.collection.createIndex({purgeAt:1},{expireAfterSeconds:0});await Job.collection.insertOne({_id:'active',state:'retry',purgeAt:old()});await require('../src/config/retention-indexes').prepare();assert.equal(await Job.countDocuments(),1);
 const counterIndexes=await Limit.collection.indexes();assert.ok(!counterIndexes.some(i=>i.key.expiresAt&&i.expireAfterSeconds!==undefined));assert.ok(counterIndexes.some(i=>i.key.purgeAt&&i.expireAfterSeconds===0));
});

test('Dos ejecuciones simultáneas se excluyen; HTTP no permite aplicar limpieza',async()=>{
 const [admin,,normal]=await users(),app=createApp(cfg);let release,entered;const waiting=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
 const first=maintenance.run(cfg,{mode:'apply',afterBatch:async()=>{entered();await waiting;}});await started;
 assert.deepEqual(await maintenance.run(cfg,{mode:'apply'}),{state:'busy'});release();await first;
 await request(app).post('/api/security/maintenance/simulate').set('Authorization','Bearer '+token(admin)).send({mode:'apply'}).expect(400);
 await request(app).post('/api/security/maintenance/simulate').set('Authorization','Bearer '+token(normal)).send({}).expect(403);
 await request(app).post('/api/security/maintenance/apply').set('Authorization','Bearer '+token(admin)).send({}).expect(404);
 assert.equal(await User.countDocuments(),3);
});
