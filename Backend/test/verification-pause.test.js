const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),request=require('supertest'),bcrypt=require('bcryptjs');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app'),User=require('../src/models/user.model');
const cfg={jwtSecret:'verification-pause-isolated-test-secret-32-characters',corsOrigins:[],verificationPaused:true,enforceLegacyVerification:true},app=createApp(cfg);let mongo,adminToken;
const pass='Temporary-test-123',post=(route,body,token)=>request(app).post('/api'+route).set('Authorization',token?'Bearer '+token:'').send(body);
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('verification_pause_test'));await User.create({email:'admin@example.test',password:await bcrypt.hash(pass,12),role:'admin',emailVerificationRequired:true});adminToken=(await post('/auth/login',{email:'admin@example.test',password:pass}).expect(200)).body.token;});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});
test('Registro y cuentas pendientes con contraseña conservan acceso sin marcar correo verificado',async()=>{
 const r=await post('/auth/register',{email:'normal@example.test',password:pass}).expect(201);assert.equal(r.body.data.emailVerified,false);const login=await post('/auth/login',{email:'normal@example.test',password:pass}).expect(200);await request(app).get('/api/users/me').set('Authorization','Bearer '+login.body.token).expect(200);
 cfg.verificationPaused=false;await post('/auth/login',{email:'normal@example.test',password:pass}).expect(403);cfg.verificationPaused=true;await request(app).get('/api/users/me').set('Authorization','Bearer '+login.body.token).expect(200);
});
test('Admin elige contraseña, no se devuelve; sin contraseña usa invitación y no genera clave desconocida',async()=>{
 const data={name:'Representante',email:'rep@example.test',position:'Pastor',password:pass},r=await post('/representatives',data,adminToken).expect(201);assert.equal(r.body.delivery,'not_requested');assert.equal(r.body.initialPassword,undefined);const u=await User.findById(r.body.data._id).select('+password');assert.equal(u.emailVerifiedAt,null);assert.equal(u.invitationPending,false);assert.ok(await bcrypt.compare(pass,u.password));const token=(await post('/auth/login',{email:data.email,password:pass}).expect(200)).body.token;await request(app).get('/api/churches/manage').set('Authorization','Bearer '+token).expect(200);
 await post('/representatives',{...data,email:'weak@example.test',password:'123'},adminToken).expect(400);await post('/representatives',{name:'R',email:'blank@example.test',position:'P',password:''},adminToken).expect(503);assert.equal(await User.countDocuments({email:'blank@example.test'}),0);
 let mail;cfg.mail={key:'test',from:'test@example.test',appUrl:'https://example.test'};app.locals.mailFetch=async(url,opts)=>{mail=JSON.parse(opts.body);return{ok:true};};const invited=await post('/representatives',{name:'R',email:'invite@example.test',position:'P',password:''},adminToken).expect(201);assert.equal(invited.body.data.invitationPending,true);assert.ok(mail.text.includes('aceptar-invitacion'));
 const normal=(await post('/auth/login',{email:'normal@example.test',password:pass})).body.token;await post('/representatives',{...data,email:'forbidden@example.test'},normal).expect(403);
});
test('La pausa mantiene los límites de creación por conexión',async()=>{
 for(let i=0;i<9;i++)await post('/auth/register',{email:`limited${i}@example.test`,password:pass}).expect(201);
 await post('/auth/register',{email:'over@example.test',password:pass}).expect(429);assert.equal(await User.countDocuments({email:'over@example.test'}),0);
});
