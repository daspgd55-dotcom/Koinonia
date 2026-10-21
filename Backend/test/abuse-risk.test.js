const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),express=require('express'),request=require('supertest');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),Counter=require('../src/models/abuse-counter.model'),risk=require('../src/services/abuse-risk.service'),{loadConfig}=require('../src/config/env');
const config={jwtSecret:'isolated-abuse-secret-with-more-than-32-characters',securityPolicy:{advancedAbuseMode:'observe'}},now=1800000000000;let mongo;
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('abuse_isolated'));await Counter.init();});
after(async()=>{await disconnectDB();await mongo?.stop();});
test('Contadores atómicos compartidos, cardinalidad acotada y vencimiento',async()=>{
 const connection=await require('mongoose').createConnection(mongo.getUri('abuse_isolated')).asPromise(),other=connection.model('AbuseCounter',Counter.schema);
 let results;try{results=await Promise.all(Array.from({length:60},(_,i)=>risk.increment('test-concurrency',now,i%2?other:Counter)));}finally{await connection.close();}
 assert.equal(new Set(results.map(x=>x.count)).size,60);assert.equal(Math.max(...results.map(x=>x.count)),60);
 const reset=await risk.increment('test-concurrency',now+risk.WINDOW);assert.equal(reset.count,1);assert.ok(reset.expiresAt>new Date(now));
 const late=await risk.increment('test-concurrency',now);assert.equal(late.bucket,reset.bucket);assert.equal(late.count,1);
 assert.equal(await Counter.countDocuments({_id:'test-concurrency'}),1);
 for(let i=0;i<10000;i++)assert.ok(risk.slot(config.jwtSecret,String(i))<risk.SLOTS);
 assert.ok((await Counter.collection.indexes()).some(i=>i.expireAfterSeconds===0));
});
test('Instancias independientes: cuenta atacada por IP rotativas, sin registrar PII',async()=>{
 const logs=[];let result;
 for(let i=0;i<32;i++)result=await risk.assess({...config},{operation:'login',email:' Victim@EXAMPLE.test ',ip:`192.0.2.${i}`},{now,record:e=>logs.push(e)});
 assert.equal(result.action,'captcha');assert.ok(result.reasons.includes('account'));assert.equal(logs.filter(e=>e.reasons.includes('account')).length,1);
 const stored=JSON.stringify(await Counter.find().lean())+JSON.stringify(logs);assert.ok(!/victim|192\.0\.2|password|token/i.test(stored));
});
test('Red compartida: muchas cuentas no implican CAPTCHA por fuente solamente',async()=>{
 let result;
 for(let i=0;i<122;i++)result=await risk.assess(config,{operation:'register',email:`person${i}@example.test`,ip:'198.51.100.8'},{now,record:()=>{}});
 assert.equal(result.action,'monitor');assert.deepEqual(result.reasons,['source']);
 assert.equal(risk.sourceKey('::ffff:192.0.2.1'),risk.sourceKey('192.0.2.1'));
 assert.equal(risk.sourceKey('2001:db8:abcd:1200::1'),risk.sourceKey('2001:db8:abcd:12ff::2'));
});
test('Volumen global y por operación; fallo y demora no añaden rechazos',async()=>{
 await risk.increment('reset-password:operation',now);await Counter.updateOne({_id:'reset-password:operation'},{$set:{count:1000}});
 let measured=await risk.assess(config,{operation:'reset-password',ip:'203.0.113.1'},{now,record:()=>{}});assert.ok(measured.reasons.includes('operation'));
 await Counter.updateOne({_id:'global'},{$set:{count:3000}});
 measured=await risk.assess(config,{operation:'verify-email',ip:'203.0.113.2'},{now,record:()=>{}});assert.ok(measured.reasons.includes('global'));
 for(const kind of ['global','operation'])assert.equal(risk.evaluate({[kind]:risk.thresholds[kind]+1}).action,'captcha');
 for(const bump of [async()=>{throw Error('private error');},()=>new Promise(()=>{})]){
  const r=await risk.assess(config,{operation:'login',email:'test@example.test',ip:'127.0.0.1'},{bump});assert.deepEqual(r,{action:'unknown',reasons:['storage_unavailable'],observed:false});
 }
 const r=await risk.assess({...config,securityPolicy:{advancedAbuseMode:'off'}},{operation:'login'},{bump:()=>{throw Error();}});assert.equal(r.observed,false);
});
test('Proxy: cabecera arbitraria ignorada sin confianza; CIDR limita remitentes',async()=>{
 const base={MONGO_URI:'mongodb://127.0.0.1/isolated',JWT_SECRET:config.jwtSecret};
 const cfg=loadConfig(base),app=express();if(cfg.trustProxy)app.set('trust proxy',cfg.trustProxy);app.get('/',(req,res)=>res.json({ip:req.ip}));
 assert.notEqual((await request(app).get('/').set('X-Forwarded-For','1.2.3.4')).body.ip,'1.2.3.4');
 const trust=loadConfig({...base,TRUST_PROXY_CIDRS:'10.0.0.0/8'}).trustProxy;assert.equal(trust('10.0.0.1'),true);assert.equal(trust('192.0.2.1'),false);
 assert.throws(()=>loadConfig({...base,TRUST_PROXY_CIDRS:'bad'}),/inválido/);assert.throws(()=>loadConfig({...base,TRUST_PROXY_CIDRS:'10.0.0.0/8',TRUST_PROXY_HOPS:'1'}),/no ambos/);
});
