const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),express=require('express'),request=require('supertest'),path=require('node:path');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),Used=require('../src/models/captcha-use.model'),captcha=require('../src/services/captcha.service'),{errorHandler}=require('../src/utils/errors'),{createApp}=require('../src/app'),Counter=require('../src/models/abuse-counter.model');
const cfg={jwtSecret:'captcha-isolated-secret-more-than-32-characters',corsOrigins:[],verificationPaused:true,securityPolicy:{captchaMode:'enforce',advancedAbuseMode:'observe'},captcha:{siteKey:'isolated-key',secret:'isolated-secret',hostnames:['example.test']}};let mongo;
function app(result,mode='enforce',risk='captcha'){
 const a=express();a.use(express.json());a.use((req,res,next)=>{res.locals.abuseRisk={action:risk};next();});a.use(captcha.middleware({...cfg,securityPolicy:{...cfg.securityPolicy,captchaMode:mode}},{verify:async()=>{if(result instanceof Error)throw result;return result;}}));a.post('/login',(req,res)=>res.json({ok:true}));a.use(errorHandler);return a;
}
const good=()=>({success:true,action:'login',hostname:'example.test',challenge_ts:new Date().toISOString()});
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('captcha_isolated'));await Used.init();});
after(async()=>{await disconnectDB();await mongo?.stop();});
test('API directa exige desafío para todas las operaciones, sin revelar cuentas',async()=>{
 const a=createApp(cfg);await Counter.create({_id:'global',bucket:Math.floor(Date.now()/900000),count:3001,expiresAt:new Date(Date.now()+900000)});
 for(const action of ['login','register','forgot-password','reset-password','resend-verification','verify-email','accept-invitation']){
  const r=await request(a).post('/api/auth/'+action).send({email:'unknown@example.test'}).expect(403);assert.equal(r.body.error.code,'CAPTCHA_REQUIRED');assert.equal(r.body.error.details.captcha.action,action);assert.ok(!JSON.stringify(r.body).includes('isolated-secret'));
 }
});
test('Rechaza inválidos, vencidos, hostname/acción incorrectos y proveedor caído',async()=>{
 for(const change of [{success:false},{challenge_ts:new Date(Date.now()-301000).toISOString()},{challenge_ts:'bad'},{hostname:'evil.test'},{action:'register'}])await request(app({...good(),...change})).post('/login').set('X-Captcha-Token','invalid').expect(403);
 await request(app(Error('secret-provider-error'))).post('/login').set('X-Captcha-Token','failure').expect(503);
 await request(app(good(),'enforce','unknown')).post('/login').expect(403);
});
test('Consumo atómico de token y sin reiniciar cuotas al resolverlo',async()=>{
 const a=app(good()),responses=await Promise.all([1,2].map(()=>request(a).post('/login').set('X-Captcha-Token','single-use')));assert.deepEqual(responses.map(r=>r.status).sort(),[200,403]);
 await request(a).post('/login').set('X-Captcha-Token','single-use').expect(403);const stored=JSON.stringify(await Used.find().lean());assert.ok(!stored.includes('single-use'));
 const limit=require('../src/services/account-security.service');await limit.quota(cfg,'captcha-regression','account',1,900000);await request(a).post('/login').set('X-Captcha-Token','another').expect(200);await assert.rejects(limit.quota(cfg,'captcha-regression','account',1,900000),e=>e.code==='RATE_LIMIT');
});
test('Observación no muestra ni exige CAPTCHA; configuración incompleta no degrada enforce',async()=>{
 await request(app(Error(),'observe')).post('/login').expect(200);await request(app(Error(),'off')).post('/login').expect(200);await request(app(Error(),'enforce','allow')).post('/login').expect(200);
 assert.throws(()=>captcha.validateConfig({...cfg,captcha:null}));assert.throws(()=>captcha.configFromEnv({TURNSTILE_SITE_KEY:'only'}));
});
test('Adaptador consulta Siteverify sin enviar datos personales y falla cerrado ante almacenamiento caído',async()=>{
 const original=global.fetch;
 try{global.fetch=async(url,options)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.deepEqual(JSON.parse(options.body),{secret:'isolated-secret',response:'adapter-proof'});assert.ok(options.signal);return {ok:true,json:async()=>good()};};assert.equal((await captcha.turnstile(cfg.captcha).verify('adapter-proof')).success,true);
  global.fetch=async()=>({ok:false});await assert.rejects(captcha.turnstile(cfg.captcha).verify('adapter-proof'));
 }finally{global.fetch=original;}
 const create=Used.create;try{Used.create=async()=>{throw Error('storage failure');};await request(app(good())).post('/login').set('X-Captcha-Token','store-failure').expect(503);}finally{Used.create=create;}
});
