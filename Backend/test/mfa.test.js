const {test,before,after,beforeEach}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),request=require('supertest'),bcrypt=require('bcryptjs');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model'),Mfa=require('../src/models/mfa.model'),svc=require('../src/services/mfa.service');
const cfg={jwtSecret:'mfa-isolated-test-only-secret-longer-than-32',verificationPaused:true,corsOrigins:[],enableTestUi:false,mfa:{activeKeyId:'test',keys:{test:Buffer.alloc(32,7).toString('base64')}}},pass='Test-password-123';let app=createApp(cfg),mongo,n=0;
const post=(route,body,token)=>request(app).post('/api'+route).set('Authorization',token?'Bearer '+token:'').send(body);
async function account(role='admin'){const email=`mfa${++n}@example.test`,user=await User.create({email,password:await bcrypt.hash(pass,12),role});return {user,email,token:(await post('/auth/login',{email,password:pass}).expect(200)).body.token};}
async function enroll(a){const setup=(await post('/auth/mfa/setup',{currentPassword:pass},a.token).expect(200)).body;const result=(await post('/auth/mfa/confirm',{code:svc.totp(setup.secret).generate()},a.token).expect(200)).body;return {...a,...setup,codes:result.recoveryCodes};}
async function challenge(a){return (await post('/auth/login',{email:a.email,password:pass}).expect(200)).body;}
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('mfa_isolated'));await Mfa.init();});
beforeEach(async()=>{app=createApp(cfg);await require('../src/models/security-limit.model').deleteMany({});});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});
test('Inscripción exclusiva, contraseña, confirmación, cifrado y revocación sin verificar correo',async()=>{
 const rep=await account('representative');await post('/auth/mfa/setup',{currentPassword:pass},rep.token).expect(403);
 const a=await account();await post('/auth/mfa/setup',{currentPassword:'wrong'},a.token).expect(401);const e=await enroll(a);assert.equal(e.codes.length,10);assert.ok(e.qr.startsWith('data:image/png;base64,'));
 const row=await Mfa.findOne({user:a.user._id}).select('+secret +recoveryHashes');assert.ok(!row.secret.includes(e.secret));assert.ok(!row.recoveryHashes.includes(e.codes[0]));assert.equal(row.history.at(-1).action,'enabled');assert.equal((await User.findById(a.user._id)).emailVerifiedAt,null);
 await request(app).get('/api/users/me').set('Authorization','Bearer '+a.token).expect(401);
 const c=await challenge(a);assert.equal(c.mfaRequired,true);assert.equal(c.token,undefined);assert.equal(c.data,undefined);
 await request(app).get('/api/users/me').set('Authorization','Bearer '+c.challenge).expect(401);
 const logged=(await post('/auth/mfa/login',{challenge:c.challenge,code:e.codes[0]}).expect(200)).body;
 const status=(await request(app).get('/api/auth/mfa').set('Authorization','Bearer '+logged.token).expect(200)).body;assert.deepEqual(Object.keys(status).sort(),['configured','enabled','recoveryRemaining','required']);assert.equal(status.recoveryRemaining,9);
 await post('/auth/mfa/setup',{currentPassword:pass},logged.token).expect(409);
});
test('Desafíos temporales, aislamiento, uso único concurrente de recuperación y TOTP',async()=>{
 const a=await enroll(await account()),b=await enroll(await account()),c=await challenge(a);
 await post('/auth/mfa/login',{challenge:c.challenge,code:b.codes[0]}).expect(401);
 const results=await Promise.all([1,2].map(()=>post('/auth/mfa/login',{challenge:c.challenge,code:a.codes[0]})));assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
 const next=await challenge(a);await post('/auth/mfa/login',{challenge:next.challenge,code:a.codes[0]}).expect(401);
 const future=svc.totp(a.secret).generate({timestamp:Date.now()+30000});await post('/auth/mfa/login',{challenge:next.challenge,code:future}).expect(200);
 const again=await challenge(a);await post('/auth/mfa/login',{challenge:again.challenge,code:future}).expect(401);
 await Mfa.updateOne({user:a.user._id},{$set:{challengeUntil:new Date(0)}});await post('/auth/mfa/login',{challenge:again.challenge,code:a.codes[1]}).expect(401);
});
test('Administración de MFA exige contraseña y prueba; regeneración y baja revocan sesiones',async()=>{
 const a=await enroll(await account()),c=await challenge(a),token=(await post('/auth/mfa/login',{challenge:c.challenge,code:a.codes[0]}).expect(200)).body.token;
 await post('/auth/mfa/manage',{action:'regenerate',currentPassword:'wrong',code:a.codes[1]},token).expect(401);
 const r=await post('/auth/mfa/manage',{action:'regenerate',currentPassword:pass,code:a.codes[1]},token).expect(200);assert.equal(r.body.recoveryCodes.length,10);
 await request(app).get('/api/users/me').set('Authorization','Bearer '+token).expect(401);const c2=await challenge(a);await post('/auth/mfa/login',{challenge:c2.challenge,code:a.codes[2]}).expect(401);
 const t2=(await post('/auth/mfa/login',{challenge:c2.challenge,code:r.body.recoveryCodes[0]}).expect(200)).body.token;
 await post('/auth/mfa/manage',{action:'disable',currentPassword:pass,code:r.body.recoveryCodes[1]},t2).expect(200);
 await request(app).get('/api/users/me').set('Authorization','Bearer '+t2).expect(401);assert.ok((await challenge(a)).token);
});
test('Recuperar contraseña conserva MFA e invalida desafíos previos',async()=>{
 const a=await enroll(await account()),c=await challenge(a);let link;
 cfg.mail={key:'simulated',from:'test@example.test',appUrl:'https://example.test'};
 app.locals.mailFetch=async(_url,opts)=>{const found=JSON.parse(opts.body).text.match(/https:\/\/\S+/);if(found)link=found[0];return {ok:true};};
 await post('/auth/forgot-password',{email:a.email}).expect(200);const token=new URLSearchParams(link.split('?')[1]).get('token');const newPassword='Replacement-test-456';
 await post('/auth/reset-password',{token,newPassword}).expect(200);
 await post('/auth/mfa/login',{challenge:c.challenge,code:a.codes[0]}).expect(401);
 const next=(await post('/auth/login',{email:a.email,password:newPassword}).expect(200)).body;assert.equal(next.mfaRequired,true);
 await post('/auth/mfa/login',{challenge:next.challenge,code:a.codes[0]}).expect(200);
});
test('Cuotas de desafío limitan intentos y la obligación global permite solo inscribirse',async()=>{
 const a=await enroll(await account()),c=await challenge(a);for(let i=0;i<5;i++)await post('/auth/mfa/login',{challenge:c.challenge,code:'bad'}).expect(401);await post('/auth/mfa/login',{challenge:c.challenge,code:a.codes[0]}).expect(429);
 const strict=createApp({...cfg,securityPolicy:{adminMfaRequired:true}}),plain=await account();
 const result=(await request(strict).post('/api/auth/login').send({email:plain.email,password:pass}).expect(200)).body;assert.equal(result.mfaEnrollmentRequired,true);
 await request(strict).get('/api/churches/manage').set('Authorization','Bearer '+result.token).expect(403);
 await request(strict).get('/api/auth/mfa').set('Authorization','Bearer '+result.token).expect(200);
 await request(strict).patch('/api/users/me').set('Authorization','Bearer '+result.token).send({}).expect(403);
});
test('Configuración pendiente vence y el sobre cifrado está vinculado al usuario y admite llavero',async()=>{
 const a=await account(),setup=(await post('/auth/mfa/setup',{currentPassword:pass},a.token).expect(200)).body;
 await Mfa.updateOne({user:a.user._id},{$set:{pendingUntil:new Date(0)}});
 await post('/auth/mfa/confirm',{code:svc.totp(setup.secret).generate()},a.token).expect(401);assert.equal((await Mfa.findOne({user:a.user._id})).active,false);
 const sealed=svc.seal(setup.secret,a.user.id,cfg);assert.equal(svc.unseal(sealed,a.user.id,cfg),setup.secret);assert.throws(()=>svc.unseal(sealed,'other-account',cfg),/segundo factor/);
 const rotated={mfa:{activeKeyId:'next',keys:{...cfg.mfa.keys,next:Buffer.alloc(32,8).toString('base64')}}};assert.equal(svc.unseal(sealed,a.user.id,rotated),setup.secret);assert.ok(svc.seal(setup.secret,a.user.id,rotated).startsWith('next.'));
 assert.throws(()=>svc.unseal(sealed,a.user.id,{mfa:{activeKeyId:'next',keys:{next:rotated.mfa.keys.next}}}),/segundo factor/);
});
