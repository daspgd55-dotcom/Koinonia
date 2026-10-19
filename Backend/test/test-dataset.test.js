const {test}=require('node:test'),assert=require('node:assert/strict');
const {build,nameIdentity,documentFor}=require('../scripts/build-test-dataset');
const row=(name,extra={})=>({_id:'fixture',identification:{name},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},...extra});
test('DNS alternativo se limita al proceso y el diagnóstico no revela credenciales',()=>{
 const dns=require('node:dns'),{configureDns,failureDetails}=require('../scripts/import-test-dataset'),before=dns.getServers();
 try{configureDns('1.1.1.1');assert.deepEqual(dns.getServers(),['1.1.1.1']);assert.throws(()=>configureDns('invalid'));}finally{dns.setServers(before);}
 const detail=failureDetails(Object.assign(new Error('querySrv private-host'),{code:'ECONNREFUSED',syscall:'querySrv'}));assert.equal(detail.step,'dns');assert(!JSON.stringify(detail).includes('private-host'));
});
test('Nombre presbiteriano produce inferencia trazable y no datos verificados',()=>{
 const f=build(row('Iglesia Presbiteriana Centro'),1);
 assert.equal(f.church.christianIdentity.denomination,'Presbiteriana');assert.equal(f.church.christianIdentity.branch,'Protestante');
 assert.equal(f.fieldProvenance['christianIdentity.denomination'].origin,'name_inference');assert.equal(f.fieldProvenance['christianIdentity.denomination'].verified,false);
});
test('Metodista Pentecostal usa la regla más específica',()=>{assert.equal(nameIdentity('Iglesia Metodista Pentecostal').denomination,'Pentecostal');});
test('No sobrescribe datos existentes ante un nombre contradictorio',()=>{
 const original=row('Iglesia Presbiteriana',{christianIdentity:{branch:'Protestante',denomination:'Bautista'}}),f=build(original,1);
 assert.equal(f.church.christianIdentity.denomination,'Bautista');assert(f.issues.includes('existing_denomination_differs_from_name_hint'));assert.equal(original.community,undefined);
});
test('Completa rama desde denominación existente y restringe relleno según rama',()=>{
 const f=build(row('Comunidad Centro',{christianIdentity:{denomination:'Presbiteriana'}}),1);assert.equal(f.church.christianIdentity.branch,'Protestante');assert.equal(f.fieldProvenance['christianIdentity.branch'].origin,'existing_data_inference');
 const catholic=build(row('Comunidad Centro',{christianIdentity:{branch:'Católica'}}),1);assert.equal(catholic.church.christianIdentity.denomination,'Católica Romana');
});
test('El control conserva ausencias y las etiquetas sensibles no se asignan al azar',()=>{
 assert.equal(build(row('Iglesia Presbiteriana'),0).enrichedFields.length,0);
 const f=build(row('Iglesia de Jesucristo de los Santos de los Últimos Días'),1);assert.equal(f.church.christianIdentity.branch,undefined);assert.equal(f.church.doctrine,undefined);
});
test('Reuniones y doctrina generadas mantienen concordancia básica',()=>{
 const f=build(row('Iglesia Adventista'),1);assert.equal(f.church.meetings[0].schedule[0].day,'Sábado');assert(!f.church.doctrine.characteristics.includes('Bautismo infantil'));
 const c=build(row('Parroquia San Pedro'),1);assert.equal(c.church.meetings[0].type,'Misa');assert(!c.church.doctrine.characteristics.includes('Bautismo de creyentes'));
});
test('Corpus identifica los campos inferidos y sintéticos y enlaza la ficha',()=>{
 const f=build(row('Iglesia Presbiteriana'),1),d=documentFor(f);assert.equal(d.churchId,f.id);assert(d.text.includes('[INFERIDO NO VERIFICADO]'));assert(d.text.includes('[SINTÉTICO NO VERIFICADO]'));assert.deepEqual(d.sourceFields,f.enrichedFields);
});
test('El lote completo es reproducible, mantiene originales y cumple el modelo de Mongo',async()=>{
 const fs=require('node:fs'),path=require('node:path'),{BATCH,rebuild}=require('../scripts/build-test-dataset'),{prepare}=require('../scripts/import-test-dataset');
 const fixtures=fs.readFileSync(path.resolve(__dirname,'../../outputs',BATCH,'churches.test.ndjson'),'utf8').trim().split(/\r?\n/).map(JSON.parse),rows=rebuild().rows;
 for(const [index,f]of fixtures.entries()){
  const original=rows.find(r=>(r.externalProfile?.placeId||String(r._id))===f.baseReference.key);assert(original);assert.deepEqual(JSON.parse(JSON.stringify(build(original,index))),f);
  for(const p of f.enrichedFields){const old=p.split('.').reduce((a,k)=>a?.[k],original);assert(old==null||old===''||(Array.isArray(old)&&!old.length));}
 }
 const plan=await prepare();assert.equal(plan.documents.length,336);assert.equal(new Set(plan.documents.map(d=>String(d._id))).size,336);
 assert(plan.documents.every(d=>d.metadata.testData&&d.verification.authorized===false));
});
