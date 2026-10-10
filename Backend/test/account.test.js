const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),path=require('node:path');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model');
const cfg={jwtSecret:'account-test-only-secret-longer-than-32-characters',corsOrigins:[],mail:{key:'private-key',from:'test@example.org',appUrl:'https://example.org'}};
const app=createApp(cfg);let mongo,token,mail;
const pass='Start123',next='Next1234';
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('account_tests'));await request(app).post('/api/auth/register').send({email:'account@example.org',password:'Short12'}).expect(400);await request(app).post('/api/auth/register').send({email:'account@example.org',password:pass}).expect(201);token=(await request(app).post('/api/auth/login').send({email:'account@example.org',password:pass})).body.token;app.locals.mailFetch=async(url,opts)=>{mail=JSON.parse(opts.body);return{ok:true};};});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});
test('Cambiar contraseña valida la actual, no acepta claves débiles e invalida sesiones',async()=>{
 const call=body=>request(app).post('/api/auth/change-password').set('Authorization','Bearer '+token).send(body);
 await call({currentPassword:'incorrect',newPassword:next}).expect(400);
 await call({currentPassword:pass,newPassword:'Short12'}).expect(400);
 await call({currentPassword:pass,newPassword:next}).expect(200);
 await request(app).get('/api/users/me').set('Authorization','Bearer '+token).expect(401);
 await request(app).post('/api/auth/login').send({email:'account@example.org',password:pass}).expect(401);
 token=(await request(app).post('/api/auth/login').send({email:'account@example.org',password:next}).expect(200)).body.token;
});
test('Recuperación: respuesta genérica, token privado, vencimiento y uso único',async()=>{
 const unknown=await request(app).post('/api/auth/forgot-password').send({email:'missing@example.org'}).expect(200);
 const known=await request(app).post('/api/auth/forgot-password').send({email:'account@example.org'}).expect(200);assert.deepEqual(known.body,unknown.body);
 const resetToken=/token=([a-f0-9]{64})/.exec(mail.text)[1];assert.equal(mail.to[0],'account@example.org');
 const u=await User.findOne({email:'account@example.org'}).select('+passwordReset.hash');assert.notEqual(u.passwordReset.hash,resetToken);
 const profile=await request(app).get('/api/users/me').set('Authorization','Bearer '+token).expect(200);assert.ok(!JSON.stringify(profile.body).includes(resetToken));assert.equal(profile.body.data.passwordReset,undefined);
 await User.updateOne({_id:u._id},{$set:{'passwordReset.expiresAt':new Date(0)}});
 await request(app).post('/api/auth/reset-password').send({token:resetToken,newPassword:pass}).expect(400);
 await User.updateOne({_id:u._id},{$set:{'passwordReset.expiresAt':new Date(Date.now()+60000)}});
 const responses=await Promise.all([1,2].map(()=>request(app).post('/api/auth/reset-password').send({token:resetToken,newPassword:pass})));assert.deepEqual(responses.map(x=>x.status).sort(),[200,400]);
 await request(app).get('/api/users/me').set('Authorization','Bearer '+token).expect(401);
 await request(app).post('/api/auth/login').send({email:'account@example.org',password:pass}).expect(200);
});
test('Correo sin configurar y fallo de entrega no exponen enlaces ni cuentas',async()=>{
 app.locals.mailFetch=async()=>{throw Error('provider failure');};
 const r=await request(app).post('/api/auth/forgot-password').send({email:'account@example.org'}).expect(200);assert.equal(r.body.token,undefined);
 assert.equal((await User.findOne({email:'account@example.org'}).select('+passwordReset.hash')).passwordReset?.hash,undefined);
 cfg.mail=null;await request(app).post('/api/auth/forgot-password').send({email:'account@example.org'}).expect(503);
});
