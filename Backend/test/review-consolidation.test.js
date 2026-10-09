const test=require('node:test'),assert=require('node:assert/strict');
const {score,date,complement,planReview}=require('../src/services/review-consolidation.service');
const make=(id,address='Calle Prueba 10, Santiago',name='Comunidad Prueba')=>({identification:{name},location:{address,commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},externalProfile:{provider:'google_maps',placeId:id,mapsUrl:'https://www.google.com/maps/search/?query_place_id='+id,sourceTitle:name,sourceAddress:address,sourceCity:'Santiago',categories:['Church'],capturedAt:'2026-05-18T00:00:00.000Z',openingHours:[]}});
const item=c=>({externalKey:'google_maps:'+c.externalProfile.placeId,decision:'candidate',observations:[{record:{schemaVersion:'koinonia.church-import.v1',externalKey:'google_maps:'+c.externalProfile.placeId,church:c,provenance:{batchId:'fixture',sourceFile:'fixture.xlsx',sourceRow:2,issues:[]}}}]});
test('Prioridad por completitud y fecha real; complementa sin reemplazar ganador',()=>{
 const a=make('AAAAA'),b=make('BBBBB');b.contact={phone:'+56912345678'};assert.ok(score(b)>score(a));
 b.externalProfile.capturedAtBasis='export_filename_timezone_unknown';assert.equal(date(b),0);
 assert.deepEqual(complement({x:'ganador',other:[]},{x:'otro',other:['dato'],new:'dato'}),{x:'ganador',other:['dato'],new:'dato'});
 const plans=planReview([item(a),item(b)],[]);assert.equal(plans.length,1);assert.equal(plans[0].winner.placeId,'BBBBB');assert.equal(plans[0].content.contact.phone,b.contact.phone);
 const c=make('CCCCC');c.externalProfile.capturedAt='2026-09-30T00:00:00.000Z';assert.equal(planReview([item(a),item(c)],[])[0].winner.placeId,'CCCCC');
});
test('No fusiona por postal ni nombre genérico y protege fichas institucionales',()=>{
 const a=make('AAAAA','Calle Uno 1','Iglesia'),b=make('BBBBB','Calle Dos 2','Iglesia');a.location.postalCode=b.location.postalCode='8320000';assert.equal(planReview([item(a),item(b)],[]).length,2);
 a._id='000000000000000000000001';a.metadata={testData:false};a.active=true;assert.equal(planReview([item(make('AAAAA'))],[a])[0].action,'review');
});
test('Aplicación real: fusiona, mueve referencias, conserva selección reciente y no repite',async()=>{
 const {MongoMemoryServer}=require('mongodb-memory-server'),mongoose=require('mongoose'),fs=require('node:fs/promises'),path=require('node:path');
 const run=require('node:util').promisify(require('node:child_process').execFile);
 const Church=require('../src/models/church.model'),User=require('../src/models/user.model'),Interaction=require('../src/models/interaction.model'),Source=require('../src/models/source.model');
 const mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve('.cache/mongodb')}});
 try{
  await mongoose.connect(mongo.getUri('review_test_demo'));await Church.init();await Interaction.init();
  const admin=await User.create({email:'review@example.test',password:'unused',role:'admin'});
  const create=c=>Church.create({...c,createdBy:admin._id,metadata:{testData:true,dataStatus:'published',version:1},verification:{authorized:false,source:'google_maps'}});
  const a=await create(make('AAAAA'));const rich=make('BBBBB');rich.contact={website:'https://example.org',phone:'+56912345678'};const b=await create(rich);
  const e=await create(make('EEEEE','Otra 50','Persona excluida'));
  await Interaction.create({user:admin._id,church:a._id,type:'saved',updatedAt:new Date('2026-01-01')});await Interaction.create({user:admin._id,church:b._id,type:'discarded',updatedAt:new Date('2026-09-01')});
  const source=await Source.create({church:a._id,title:'Fuente',kind:'website',createdBy:admin._id});
  const dir=await fs.mkdtemp(path.resolve('.cache/review-test-'));const inventory=[item(make('CCCCC')),item(make('DDDDD','Nueva 20','Nueva Comunidad')),{externalKey:'google_maps:EEEEE',decision:'excluded',reason:'person',observations:[]}];
  await fs.writeFile(path.join(dir,'consolidated.ndjson'),inventory.map(x=>JSON.stringify(x)).join('\n'));
  const args=['scripts/consolidate-review.js','--directory',dir,'--admin',admin.email,'--apply'];const env={...process.env,MONGO_URI:mongo.getUri('review_test_demo'),JWT_SECRET:'review-integration-secret-at-least-32-chars'};
  await run(process.execPath,args,{env});const report=JSON.parse(await fs.readFile(path.join(dir,'applied.json')));
  assert.equal(report.applied.insert,1);assert.equal(report.applied.merge,1);assert.equal(report.applied.retired,1);assert.equal(report.applied.deactivate,1);
  const anchor=await Church.findById(b._id);assert.equal(anchor.reviewImport.activityStatus,'unverified');assert.equal((await Church.findById(a._id)).mergedInto.toString(),b.id);assert.equal((await Church.findById(e._id)).active,false);
  assert.equal((await Source.findById(source._id)).church.toString(),b.id);const interactions=await Interaction.find();assert.equal(interactions.length,1);assert.equal(interactions[0].type,'discarded');
  const before=await Church.countDocuments();await run(process.execPath,args,{env});const repeat=JSON.parse(await fs.readFile(path.join(dir,'applied.json')));assert.deepEqual(repeat.counts,{});assert.equal(await Church.countDocuments(),before);
 }finally{await mongoose.disconnect();await mongo.stop();}
});
