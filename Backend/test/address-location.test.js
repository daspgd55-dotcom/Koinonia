const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),path=require('node:path');
const {MongoMemoryServer}=require('mongodb-memory-server'),{connectDB,disconnectDB}=require('../src/config/db'),{createApp}=require('../src/app');
const Church=require('../src/models/church.model'),{referenceLocation}=require('../src/services/address-location.service');
const result={lat:-33.45,lon:-70.65,country_code:'cl',city:'Santiago',street:'Calle Prueba',housenumber:'123',formatted:'Calle Prueba 123, Santiago',result_type:'building',rank:{confidence:1}};
let results=[result],mongo,token,other;
const cfg={jwtSecret:'isolated-address-test-secret-longer-than-32-characters',corsOrigins:[],enableTestUi:false,geocoding:{apiKey:'test-only',fetch:async()=>new Response(JSON.stringify({results}))}},app=createApp(cfg);
const call=(method,url,body,t=token)=>request(app)[method]('/api'+url).set('Authorization','Bearer '+t).send(body);
const resolve=()=>call('post','/users/me/address/resolve',{address:'Calle Prueba 123',commune:'Santiago'});
before(async()=>{mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../.cache/mongodb')}});await connectDB(mongo.getUri('address_isolated'));for(const email of ['address@example.test','other@example.test']){await request(app).post('/api/auth/register').send({email,password:'Test-pass-123'}).expect(201);const r=await request(app).post('/api/auth/login').send({email,password:'Test-pass-123'}).expect(200);if(!token)token=r.body.token;else other=r.body.token;}await Church.create({createdBy:(await require('../src/models/user.model').findOne({email:'address@example.test'}))._id,identification:{name:'Prueba distancia'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'published',testData:true}});await Church.init();});
after(async()=>{await disconnectDB();if(mongo)await mongo.stop();});
test('Resolución privada, validación y confirmación vinculada a usuario y dirección',async()=>{
 await request(app).post('/api/users/me/address/resolve').send({}).expect(401);
 await call('post','/users/me/address/resolve',{address:'Sin número',commune:'Santiago'}).expect(400);
 const r=await resolve().expect(200);assert.equal(r.headers['cache-control'],'no-store');const c=r.body.data[0];assert.ok(c.token);assert.ok(!JSON.stringify(r.body).includes('test-only'));
 const body={searchContext:{address:c.address,locationSource:'address'},preferences:{commune:c.commune,radiusKm:5},criterionModes:{radiusKm:'preferred'},addressToken:c.token};
 await call('patch','/users/me',body,other).expect(400);
 await call('patch','/users/me',{...body,searchContext:{...body.searchContext,address:'Otra calle 321'}}).expect(400);
 await call('patch','/users/me',{searchContext:{addressPoint:{lat:1,lng:1}}}).expect(400);
 const saved=await call('patch','/users/me',body).expect(200);assert.ok(saved.body.data.searchContext.addressPoint);assert.equal(saved.body.data.preferences.location?.lat,undefined);
 const rec=await call('post','/recommendations',{mode:'traditional'}).expect(200);assert.equal(rec.body.data.length,1);assert.ok(rec.body.data[0].church.distanceMeters<10);assert.ok(!JSON.stringify(rec.body).includes(c.address));
 await call('patch','/users/me',{expectedRevision:0,searchContext:{locationSource:'none'}}).expect(409);
 await call('patch','/users/me',{searchContext:{locationSource:'device'},preferences:{location:{lat:-33.5,lng:-70.65}}}).expect(200);
 const device=await call('post','/recommendations',{mode:'traditional'}).expect(200);assert.ok(device.body.data[0].church.distanceMeters>5000);
 await call('patch','/users/me',{searchContext:{locationSource:'none'}}).expect(200);
 const none=await call('post','/recommendations',{mode:'traditional'}).expect(200);assert.equal(none.body.data[0].church.distanceMeters,undefined);
 await call('patch','/users/me',{searchContext:{locationSource:'address'}}).expect(200);
 await call('patch','/users/me',{searchContext:{address:'Otra calle 321'}}).expect(200);
 const me=await call('get','/users/me').expect(200);assert.equal(me.body.data.searchContext.addressPoint?.lat,undefined);
 await call('patch','/users/me',{criterionModes:{radiusKm:'required'}}).expect(400);
});
test('No confunde resultados aproximados o fuera de comuna con dirección confirmada',async()=>{
 for(const invalid of [null,{...result,city:'Providencia'},{...result,result_type:'street'},{...result,rank:{confidence:.3}},{...result,lat:-40}]){results=[invalid];const r=await resolve().expect(200);assert.deepEqual(r.body.data,[]);}
 const provider=cfg.geocoding;cfg.geocoding=null;await resolve().expect(503);cfg.geocoding=provider;results=[result];
});
test('Vencimiento y alteración de confirmación; errores del proveedor no filtran secretos',async()=>{
 const jwt=require('jsonwebtoken'),u=await require('../src/models/user.model').findOne({email:'address@example.test'}),payload={lat:-33.45,lng:-70.65,address:'Calle Prueba 123',commune:'Santiago'};
 const expired=jwt.sign(payload,cfg.jwtSecret,{subject:String(u._id),issuer:'koinonia-address',audience:'address-confirmation',expiresIn:-1});
 for(const addressToken of [expired,expired+'x'])await call('patch','/users/me',{searchContext:{address:payload.address},addressToken}).expect(400);
 const original=cfg.geocoding.fetch;cfg.geocoding.fetch=async()=>{throw Error('private-provider-key');};const r=await resolve().expect(503);assert.ok(!JSON.stringify(r.body).includes('private-provider-key'));cfg.geocoding.fetch=original;
});
test('Fuente explícita sin fallback silencioso al dispositivo',()=>{
 const preferences={location:{lat:-33.5,lng:-70.5},commune:'Santiago'},context={address:'Calle Prueba 123',locationSource:'address'};
 assert.equal(referenceLocation(preferences,context),null);
 assert.deepEqual(referenceLocation(preferences,{}),preferences.location);
 assert.equal(referenceLocation(preferences,{locationSource:'none'}),null);
 context.addressPoint={lat:-33.45,lng:-70.65,address:context.address,commune:'Santiago'};assert.equal(referenceLocation(preferences,context),context.addressPoint);
});
