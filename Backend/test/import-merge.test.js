const test=require('node:test'),assert=require('node:assert/strict');
const {matchRecord,mergeRecord}=require('../src/services/import-merge.service');
const make=(id,name='Iglesia Vida Nueva',address='Av. Brasil 153, Santiago')=>({_id:id,identification:{name},location:{address,commune:'Santiago',postalCode:'8340497'},externalProfile:{provider:'google_maps',placeId:id,categories:['Church'],openingHours:[]},metadata:{version:4,dataStatus:'verified'},active:false,verification:{authorized:true},media:[]});
test('Conciliación: identidad, dirección corroborada y postal no exclusivo',()=>{
 const a=make('old');assert.equal(matchRecord(make('old','Nombre actualizado'),[a]).reason,'place_id');
 assert.equal(matchRecord(make('new'),[a]).reason,'address_and_name');
 assert.equal(matchRecord(make('new','Otra comunidad'),[a]).review,true);
 assert.equal(matchRecord(make('new','Templo San Pablo','Otra calle 91'),[a]).reason,'new_identity');
 assert.equal(matchRecord(make('new','Iglesia Vida Nueva','Otra calle 91'),[a]).review,true);
 assert.equal(matchRecord(make('new'),[a,make('other')]).review,true);
});
test('Merge conserva edición humana y permisos, une medios y reconoce alias',()=>{
 const a=make('old');a.contact={phone:'+56912345678'};a.media=[{type:'image',url:'https://example.org/a',source:'manual'}];
 const b=make('new');b.contact={phone:'+56987654321',website:'https://example.org'};b.media=[{type:'image',url:'https://example.org/a',source:'maps'},{type:'image',url:'https://example.org/b',source:'maps'}];
 b.externalProfile.links=[{kind:'website',url:'https://example.org'}];
 const m=mergeRecord(a,b);assert.equal(m.result.contact.phone,a.contact.phone);assert.equal(m.result.contact.website,b.contact.website);
 assert.equal(m.result.media.length,2);assert.equal(m.result.media[0].source,'manual');assert.equal(m.result.active,false);assert.equal(m.result.verification.authorized,true);
 assert.equal(m.result.metadata.dataStatus,'verified');assert.equal(matchRecord(b,[m.result]).reason,'place_id');
 assert.equal(mergeRecord(m.result,b).changed,false);
});
test('Importador de merge: escritura real e idempotencia en Mongo temporal',async()=>{
 const {MongoMemoryServer}=require('mongodb-memory-server'),mongoose=require('mongoose'),path=require('node:path'),fs=require('node:fs/promises');
 const run=require('node:util').promisify(require('node:child_process').execFile);
 const Church=require('../src/models/church.model'),User=require('../src/models/user.model');const {readDataset,documentFor}=require('../src/services/import.service');
 const mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve('.cache/mongodb')}});
 try{
  await mongoose.connect(mongo.getUri('merge_test_demo'));await Church.init();
  const admin=await User.create({email:'merge@example.test',password:'unused-test-account',role:'admin'});
  const records=await readDataset('data/google-maps-2026-09-30/churches.import.ndjson');const doc=documentFor(records[0],admin._id);doc.media=[];doc.externalProfile.links=[];await doc.save();
  const args=['scripts/merge-churches.js','--file','data/google-maps-2026-09-30/churches.import.ndjson','--admin','merge@example.test','--report','.cache/merge-integration-report.json','--demo-publish','--apply'];
  const env={...process.env,MONGO_URI:mongo.getUri('merge_test_demo'),JWT_SECRET:'integration-test-secret-long-enough-12345'};
  await run(process.execPath,args,{env});const first=JSON.parse(await fs.readFile('.cache/merge-integration-report.json'));assert.ok(first.applied.insert>0);assert.ok(first.applied.update>0);const count=await Church.countDocuments();
  await run(process.execPath,args,{env});const second=JSON.parse(await fs.readFile('.cache/merge-integration-report.json'));assert.deepEqual(second.applied,{insert:0,update:0});assert.equal(await Church.countDocuments(),count);
 }finally{await mongoose.disconnect();await mongo.stop();}
});
