const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),request=require('supertest'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model'),Limit=require('../src/models/security-limit.model'),security=require('../src/services/account-security.service');
const cfg={jwtSecret:'isolated-security-secret-at-least-32-characters',corsOrigins:[],enableTestUi:false,requireVerifiedEmail:true,mail:{key:'fake-provider-key',from:'no-reply@example.test',appUrl:'https://example.test'}},app=createApp(cfg),mails=[];let mongo,admin,adminToken;
const pass='Password-test-123',email='new@example.test',post=(url,body,token)=>request(app).post('/api'+url).set('Authorization',token?'Bearer '+token:'').send(body),lastToken=()=>/token=([a-f0-9]{64})/.exec(mails.at(-1).text)[1];
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('security_isolated'));await Promise.all([User.init(),Limit.init()]);app.locals.mailFetch=async(url,o)=>{mails.push(JSON.parse(o.body));return{ok:true};};admin=await User.create({email:'admin@example.test',password:await bcrypt.hash(pass,12),role:'admin',emailVerifiedAt:new Date()});adminToken=(await post('/auth/login',{email:admin.email,password:pass}).expect(200)).body.token;});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});
test('Registro pendiente, duplicado genérico, tokens privados y bloqueo real de APIs',async()=>{
 const a=await post('/auth/register',{email,password:pass}).expect(202),t=lastToken(),u=await User.findOne({email}).select('+emailAction.hash');assert.ok(u.emailVerificationRequired);assert.notEqual(u.emailAction.hash,t);assert.equal(a.body.data,undefined);assert.ok(!JSON.stringify(a.body).includes(t));
 const duplicate=await post('/auth/register',{email,password:'Attacker-123'}).expect(202);assert.deepEqual(a.body,duplicate.body);assert.equal(await User.countDocuments({email}),1);
 await post('/auth/login',{email,password:pass}).expect(403);
 const forgedSession=jwt.sign({sv:0},cfg.jwtSecret,{algorithm:'HS256',subject:u.id,expiresIn:'1h',issuer:'koinonia',audience:'koinonia-api'});
 await request(app).get('/api/users/me').set('Authorization','Bearer '+forgedSession).expect(403);await post('/recommendations',{},forgedSession).expect(403);await post('/auth/verify-email',{token:t,password:'incorrect'}).expect(400);
 const concurrent=await Promise.all([1,2].map(()=>post('/auth/verify-email',{token:t,password:pass})));assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,400]);
 await post('/auth/verify-email',{token:t,password:pass}).expect(400);const login=await post('/auth/login',{email,password:pass}).expect(200);assert.ok(login.body.data.emailVerified);assert.ok(!JSON.stringify(login.body).includes(t));assert.ok(!JSON.stringify(login.body).includes('emailAction'));
});
test('Invitación exclusiva de admin, sin contraseña entregada, uso único y sin escalamiento',async()=>{
 const userToken=(await post('/auth/login',{email,password:pass})).body.token,data={name:'Representante de prueba',email:'rep@example.test',position:'Bienvenida'};
 await post('/representatives',data,userToken).expect(403);await post('/representatives',{...data,password:pass},adminToken).expect(400);
 const r=await post('/representatives',data,adminToken).expect(201),t=lastToken();assert.equal(r.body.initialPassword,undefined);assert.equal(r.body.delivery,'sent');const u=await User.findById(r.body.data._id).select('+invitedBy +emailAction.issuedBy');assert.equal(String(u.invitedBy),admin.id);assert.equal(String(u.emailAction.issuedBy),admin.id);
 await post('/auth/verify-email',{token:t,password:pass}).expect(400);await post('/auth/accept-invitation',{token:t,newPassword:pass,role:'admin'}).expect(400);
 const concurrent=await Promise.all([1,2].map(()=>post('/auth/accept-invitation',{token:t,newPassword:pass})));assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,400]);
 const login=await post('/auth/login',{email:data.email,password:pass}).expect(200);assert.equal(login.body.data.role,'representative');assert.ok(login.body.data.emailVerified);
 await post('/representatives',data,adminToken).expect(409);
});
test('Recuperación verifica propiedad, invalida sesiones, no revela cuentas y es de un solo uso',async()=>{
 const old=(await post('/auth/login',{email,password:pass})).body.token;
 const a=await post('/auth/forgot-password',{email}).expect(200),t=lastToken(),unknown=await post('/auth/forgot-password',{email:'missing@example.test'}).expect(200);assert.deepEqual(a.body,unknown.body);
 const results=await Promise.all([1,2].map(()=>post('/auth/reset-password',{token:t,newPassword:'Changed-123'})));assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
 await request(app).get('/api/users/me').set('Authorization','Bearer '+old).expect(401);const current=(await post('/auth/login',{email,password:'Changed-123'}).expect(200)).body.token;
 await post('/auth/change-password',{currentPassword:'wrong',newPassword:pass},current).expect(400);await post('/auth/change-password',{currentPassword:'Changed-123',newPassword:pass},current).expect(200);await request(app).get('/api/users/me').set('Authorization','Bearer '+current).expect(401);assert.equal(mails.at(-1).subject,'Tu contraseña de Koinonía cambió');
});
test('Caducidad, reenvío concurrente y fallo de entrega recuperable',async()=>{
 await Limit.deleteMany({});app.locals.mailFetch=async()=>{throw Error('private-secret');};const data={email:'delivery@example.test',password:pass};await post('/auth/register',data).expect(202);
 const u=await User.findOne({email:data.email}).select('+emailAction.hash +emailAction.requestedAt');assert.equal(u.emailAction.hash,undefined);assert.ok(u.emailAction.requestedAt);
 app.locals.mailFetch=async(url,o)=>{mails.push(JSON.parse(o.body));return{ok:true};};await User.updateOne({_id:u._id},{$set:{'emailAction.requestedAt':new Date(0)}});const before=mails.length;
 await Promise.all([1,2].map(()=>post('/auth/resend-verification',{email:data.email}).expect(200)));assert.equal(mails.length,before+1);const t=lastToken();await User.updateOne({_id:u._id},{$set:{'emailAction.expiresAt':new Date(0)}});await post('/auth/verify-email',{token:t,password:pass}).expect(400);
 const mail=cfg.mail;cfg.mail=null;await post('/auth/register',{email:'unavailable@example.test',password:pass}).expect(503);assert.equal(await User.countDocuments({email:'unavailable@example.test'}),0);cfg.mail=mail;
});
test('Cuotas persistentes atómicas y legado con activación gradual',async()=>{
 const attempts=await Promise.allSettled(Array.from({length:8},()=>security.quota(cfg,'test-scope','private@example.test',3,3600000)));assert.equal(attempts.filter(x=>x.status==='fulfilled').length,3);assert.equal(attempts.filter(x=>x.status==='rejected'&&x.reason.status===429).length,5);
 assert.ok(!(await Limit.find({}).lean()).some(x=>JSON.stringify(x).includes('private@example.test')));
 const legacy=await User.create({email:'legacy@example.test',password:await bcrypt.hash(pass,12),role:'admin'});const old=(await post('/auth/login',{email:legacy.email,password:pass}).expect(200)).body.token;
 cfg.enforceLegacyVerification=true;await post('/auth/login',{email:legacy.email,password:pass}).expect(403);await request(app).get('/api/users/me').set('Authorization','Bearer '+old).expect(403);
 await User.updateOne({_id:legacy._id},{$set:{emailVerifiedAt:new Date()}});await post('/auth/login',{email:legacy.email,password:pass}).expect(200);cfg.enforceLegacyVerification=false;
});
test('Límite HTTP por dirección también para cuentas inexistentes',async()=>{
 for(let i=0;i<5;i++)await post('/auth/resend-verification',{email:'limited@example.test'}).expect(200);
 await post('/auth/resend-verification',{email:'limited@example.test'}).expect(429);
 const fresh=createApp(cfg);await request(fresh).post('/api/auth/forgot-password').send({email:'limited@example.test'}).expect(429);
});
