const { test, before, after } = require('node:test'), assert = require('node:assert/strict'), request = require('supertest'), path = require('node:path'), jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server'), { connectDB, disconnectDB } = require('../src/config/db'), { createApp } = require('../src/app');
const User = require('../src/models/user.model'), Church = require('../src/models/church.model'), Community = require('../src/models/linked-community.model');
const secret = 'linked-community-isolated-test-secret-123456', app = createApp({requireVerifiedEmail:false, jwtSecret: secret, corsOrigins: [], enableTestUi: false });
let mongo, church, other, draft, legacy; const users = {}, tokens = {};
const auth = who => ({ Authorization: 'Bearer ' + tokens[who] });
const create = (who = 'rep', extra = {}) => request(app).post('/api/communities').set(auth(who)).send({ churchId: church.id, name: 'Jóvenes de prueba', type: 'youth', ...extra });
const status = (c, value, who = 'rep', version = c.version) => request(app).patch('/api/communities/' + c._id + '/status').set(auth(who)).set('If-Match', '"' + version + '"').send({ status: value });
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12', downloadDir: path.resolve(__dirname, '../.cache/mongodb') } }); await connectDB(mongo.getUri('linked_communities_test'));
  for (const [name, role] of [['admin', 'admin'], ['rep', 'representative'], ['otherRep', 'representative'], ['visitor', 'user']]) {
    users[name] = await User.create({ email: name + '@linked.test', name, password: 'unused-test-hash', role });
    tokens[name] = jwt.sign({ sv: 0 }, secret, { subject: users[name].id, issuer: 'koinonia', audience: 'koinonia-api', expiresIn: '1h' });
  }
  const seed = (name, rep, metadata) => Church.create({ identification: { name }, location: { commune: 'Santiago', address: 'Dirección pública', coordinates: { type: 'Point', coordinates: [-70.65, -33.45] }, accessibilityLevel: 'yes', accessNotes: 'Detalle privado' }, privateFields: { accessibilityLevel: true, email: true, phone: true }, contact: { email: 'private@linked.test', phone: '123456' }, metadata, representatives: [users[rep]._id], createdBy: users.admin._id });
  church = await seed('Iglesia publicada', 'rep', { dataStatus: 'verified', firstPublishedByAdminAt: new Date() });
  other = await seed('Iglesia ajena', 'otherRep', { dataStatus: 'published', firstPublishedByAdminAt: new Date() });
  draft = await seed('Iglesia borrador', 'rep', { dataStatus: 'draft' }); legacy = await seed('Publicada sin autorización previa', 'rep', { dataStatus: 'published' }); await Community.init();
});
after(async () => { await disconnectDB(); if (mongo) await mongo.stop(); });

test('Subida de foto: permisos, proveedor simulado, borrador y versión', async () => {
 const c=(await create().expect(201)).body.data,url='/api/communities/'+c._id+'/media?frame=circle',bytes=Buffer.from([255,216,255,0]);
 const upload=(who='rep',version=1)=>request(app).post(url).set(auth(who)).set('If-Match','"'+version+'"').set('Content-Type','image/jpeg').send(bytes);
 await upload('otherRep').expect(403);await upload('visitor').expect(403);await upload().expect(503);
 app.locals.config.cloudinary={cloudName:'local-test',apiKey:'test',apiSecret:'test'};
 app.locals.mediaFetch=async(url,options)=>{const id=options.body.get('public_id');return {ok:true,json:async()=>({public_id:id,secure_url:'https://res.cloudinary.com/local-test/image/upload/'+id+'.webp'})};};
 try{const result=(await upload().expect(201)).body.data;assert.equal(result.status,'draft');assert.equal(result.media[0].frame,'circle');assert.equal(result.version,2);await upload().expect(409);
 await request(app).post(url).set(auth('rep')).set('If-Match','"2"').set('Content-Type','image/jpeg').send(Buffer.from('invalid')).expect(400);
 await Community.updateOne({_id:c._id},{$set:{media:Array.from({length:7},()=>result.media[0])}});await upload('rep',2).expect(400);
 }finally{delete app.locals.config.cloudinary;delete app.locals.mediaFetch;}
});

test('Creación, borradores y permisos: rol no equivale a asignación', async () => {
  await request(app).post('/api/communities').send({}).expect(401); await create('visitor').expect(403); await create('otherRep').expect(403);
  const c = (await create('rep', { churchId: draft.id, leaders: [{ name: 'Responsable', role: 'Coordinador' }] }).expect(201)).body.data;
  assert.equal(c.status, 'draft'); assert.equal(c.version, 1); assert.deepEqual(c.location, { mode: 'none' });
  await status(c, 'published').expect(409); await status(c, 'published', 'admin').expect(409);
  const l = (await create('rep', { churchId: legacy.id }).expect(201)).body.data; await status(l, 'published').expect(409);
  await create('admin', { churchId: other.id }).expect(201);
  await request(app).get('/api/communities/manage/' + c._id).set(auth('otherRep')).expect(403);
  await request(app).get('/api/communities/manage').set(auth('visitor')).expect(403);
  await request(app).get('/api/communities/manage?churchId=' + draft.id).set(auth('otherRep')).expect(403);
  await request(app).get('/api/communities/' + c._id).expect(404);
  const rows = (await request(app).get('/api/communities/manage').set(auth('otherRep')).expect(200)).body.data;
  assert.ok(rows.every(r => r.churchId === other.id));
  await Church.updateOne({ _id: draft.id }, { $set: { 'metadata.dataStatus': 'published', 'metadata.firstPublishedByAdminAt': new Date() } });
  await status(c, 'published').expect(200);
  await Church.updateOne({ _id: draft.id }, { $set: { 'metadata.dataStatus': 'draft' } });
});

test('Validación estricta, referencias, ubicación y recursos', async () => {
  for (const body of [{ name: ' ' }, { type: 'invalid' }, { churchId: 'invalid' }, { status: 'published' }, { representatives: [users.rep.id] }, { version: 99 }, { leaders: [{ name: 'Persona', role: 'Pastor', userId: users.visitor.id }] }, { location: { mode: 'church', custom: { commune: 'Santiago' } } }, { location: { mode: 'custom' } }, { location: { mode: 'custom', custom: { commune: 'Santiago', coordinates: { type: 'Point', coordinates: [181, 0] } } } }, { contact: { website: 'javascript:alert(1)' } }, { media: [{ type: 'image', url: 'file:///secret', source: 'Propia' }] }, { media: Array.from({ length: 8 }, () => ({ type: 'image', url: 'https://example.test/a.jpg', source: 'Propia' })) }]) await create('rep', body).expect(400);
  await create('rep', { churchId: '000000000000000000000000' }).expect(404);
  await request(app).get('/api/communities/not-an-id').expect(400);
  await request(app).get('/api/communities?limit=1.5').expect(400);
  await create('rep', { location: { mode: 'custom', custom: { commune: 'Providencia', address: 'Otra dirección' } }, media: [{ type: 'image', url: 'https://example.test/a.jpg', source: 'Propia', frame: 'circle' }] }).expect(201);
});

test('Publicación, privacidad y visibilidad dinámica de iglesia sin cambiar estado hijo', async () => {
  const c = (await create('rep', { name: 'Privacidad única', location: { mode: 'church' }, contact: { email: 'secret@linked.test', phone: '999', website: 'https://example.test' }, privateFields: { email: true, phone: true } }).expect(201)).body.data;
  const published = (await status(c, 'published').expect(200)).body.data;
  let publicRow = (await request(app).get('/api/communities/' + c._id).expect(200)).body.data;
  for (const key of ['privateFields', 'createdBy', 'updatedBy', 'version', '__v', 'verification', 'metadata']) assert.equal(publicRow[key], undefined);
  assert.equal(publicRow.contact.email, undefined); assert.equal(publicRow.contact.phone, undefined); assert.equal(publicRow.church.representatives, undefined);
  assert.equal(publicRow.location.resolved.address, 'Dirección pública'); assert.equal(publicRow.location.resolved.accessNotes, undefined); assert.equal(publicRow.location.resolved.accessibilityLevel, undefined);
  for (const change of [{ 'metadata.dataStatus': 'draft' }, { 'metadata.dataStatus': 'verified', active: false }]) {
    await Church.updateOne({ _id: church.id }, { $set: change }); await request(app).get('/api/communities/' + c._id).expect(404);
    const list = (await request(app).get('/api/communities?churchId=' + church.id).expect(200)).body; assert.equal(list.pagination.total, 0);
    const stored = await Community.findById(c._id); assert.equal(stored.status, 'published'); assert.equal(stored.version, published.version);
    await request(app).get('/api/communities/manage/' + c._id).set(auth('rep')).expect(200);
  }
  await Church.updateOne({ _id: church.id }, { $set: { active: true, 'metadata.dataStatus': 'verified', 'location.address': 'Dirección actualizada' } });
  publicRow = (await request(app).get('/api/communities/' + c._id).expect(200)).body.data; assert.equal(publicRow.location.resolved.address, 'Dirección actualizada');
  const list = (await request(app).get('/api/communities?q=Privacidad&type=youth&limit=1').expect(200)).body;
  assert.equal(list.pagination.total, 1); assert.deepEqual(list.data[0], publicRow);
  const archived = (await status(published, 'archived').expect(200)).body.data; await request(app).get('/api/communities/' + c._id).expect(404);
  await status(archived, 'draft').expect(200);
});

test('PATCH conserva campos omitidos, limpia grupos explícitos y exige versión atómica', async () => {
  const c = (await create('rep', { description: 'Conservar', audience: ['Jóvenes'], contact: { email: 'private@linked.test' }, privateFields: { email: true } }).expect(201)).body.data, url = '/api/communities/' + c._id;
  await request(app).patch(url).set(auth('rep')).send({ name: 'Cambio' }).expect(428);
  await request(app).patch(url).set(auth('rep')).set('If-Match', '1').send({ name: 'Cambio' }).expect(400);
  await request(app).patch(url).set(auth('rep')).set('If-Match', '"1"').send({}).expect(400);
  await request(app).patch(url).set(auth('rep')).set('If-Match', '"1"').send({ churchId: other.id }).expect(400);
  await request(app).patch(url).set(auth('otherRep')).set('If-Match', '"1"').send({ name: 'Cambio' }).expect(403);
  const results = await Promise.all(['Uno', 'Dos'].map(name => request(app).patch(url).set(auth('rep')).set('If-Match', '"1"').send({ name })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); const updated = results.find(r => r.status === 200).body.data;
  assert.equal(updated.version, 2); assert.equal(updated.description, 'Conservar'); assert.equal(updated.privateFields.email, true); assert.deepEqual(updated.audience, ['Jóvenes']); assert.equal(updated.contact.email, 'private@linked.test');
  await status(c, 'archived').expect(409);
  const cleared = (await request(app).patch(url).set(auth('rep')).set('If-Match', '"2"').send({ contact: {}, audience: [] }).expect(200)).body.data;
  assert.equal(cleared.contact?.email, undefined); assert.deepEqual(cleared.audience, []); assert.equal(cleared.description, 'Conservar');
  const detail = await request(app).get('/api/communities/manage/' + c._id).set(auth('rep')).expect(200); assert.equal(detail.headers.etag, '"3"');
  await Church.updateOne({ _id: church.id }, { $pull: { representatives: users.rep._id } });
  await request(app).patch(url).set(auth('rep')).set('If-Match', '"3"').send({ name: 'Sin permiso' }).expect(403);
  await Church.updateOne({ _id: church.id }, { $addToSet: { representatives: users.rep._id } });
});

test('Horarios propios e heredados, validación y privacidad',async()=>{
 const meetings=[{type:'Jóvenes',modality:'Presencial',schedule:[{day:'Viernes',startTime:'19:30',durationMinutes:90}]}];await Church.updateOne({_id:church.id},{$set:{active:true,'metadata.dataStatus':'published','metadata.firstPublishedByAdminAt':new Date(),meetings,visitSettings:{emailEnabled:true,emailRecipients:['private@example.test']}}});
 const linked=(await create('rep',{schedules:{mode:'church'}}).expect(201)).body.data;await status(linked,'published').expect(200);let pub=(await request(app).get('/api/communities/'+linked._id).expect(200)).body.data;assert.equal(pub.schedules.meetings[0].schedule[0].startTime,'19:30');assert.ok(!JSON.stringify(pub).includes('private@example.test'));
 await Church.updateOne({_id:church.id},{$set:{'meetings.0.schedule.0.startTime':'20:00'}});pub=(await request(app).get('/api/communities/'+linked._id).expect(200)).body.data;assert.equal(pub.schedules.meetings[0].schedule[0].startTime,'20:00');
 const own=(await create('rep',{schedules:{mode:'custom',meetings}}).expect(201)).body.data;await status(own,'published').expect(200);assert.equal((await request(app).get('/api/communities/'+own._id)).body.data.schedules.meetings[0].schedule[0].startTime,'19:30');
 await create('rep',{schedules:{mode:'custom',meetings:[{...meetings[0],schedule:[{day:'Viernes',startTime:'99:99'}]}]}}).expect(400);await create('rep',{schedules:{mode:'church',churchId:other.id}}).expect(400);
});


test('Logo y selección estable de reuniones, aislamiento y eliminación',async()=>{
 const {randomUUID}=require('node:crypto'),a=randomUUID(),b=randomUUID();await Church.updateOne({_id:church.id},{$set:{meetings:[{id:a,type:'Culto',modality:'Presencial',schedule:[{day:'Domingo',startTime:'11:00'}]},{id:b,type:'Jóvenes',modality:'Presencial',schedule:[{day:'Viernes',startTime:'19:00'}]}]}});
 const c=(await create('rep',{schedules:{mode:'church',meetingIds:[b]},media:[{type:'image',category:'logo',url:'https://example.test/logo.png',source:'Propia',frame:'square'}]}).expect(201)).body.data;await status(c,'published').expect(200);
 const read=async()=>(await request(app).get('/api/communities/'+c._id).expect(200)).body.data;
 assert.equal((await read()).media[0].category,'logo');assert.deepEqual((await read()).schedules.meetings.map(m=>m.type),['Jóvenes']);
 await Church.updateOne({_id:church.id},{$set:{'meetings.1.schedule.0.startTime':'20:00'}});assert.equal((await read()).schedules.meetings[0].schedule[0].startTime,'20:00');
 await Church.updateOne({_id:church.id},{$pull:{meetings:{id:b}}});assert.equal((await read()).schedules.meetings.length,0);
 await create('rep',{schedules:{mode:'church',meetingIds:[randomUUID()]}}).expect(400);
 await request(app).post('/api/churches/'+church.id+'/meeting-identifiers').set(auth('otherRep')).expect(403);

});


test('Iglesia admite logo, conserva identificadores al editar y repara reuniones antiguas con versión',async()=>{
 const body={identification:{name:'Iglesia con logo'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},meetings:[{type:'Jóvenes',modality:'Presencial',schedule:[{day:'Viernes',startTime:'19:00'}]}],media:[{type:'image',category:'logo',frame:'square',url:'https://example.test/logo.png',source:'Propia'}]};
 const c=(await request(app).post('/api/churches').set(auth('admin')).send(body).expect(201)).body.data;assert.ok(c.meetings[0].id);assert.equal(c.media[0].category,'logo');
 const next=(await request(app).put('/api/churches/'+c._id).set(auth('admin')).set('If-Match','"'+c.metadata.version+'"').send({...body,meetings:c.meetings.map(m=>({...m,schedule:[{day:'Viernes',startTime:'20:00'}]}))}).expect(200)).body.data;assert.equal(next.meetings[0].id,c.meetings[0].id);
 await Church.updateOne({_id:c._id},{$unset:{'meetings.0.id':''}});
 const fixed=(await request(app).post('/api/churches/'+c._id+'/meeting-identifiers').set(auth('admin')).set('If-Match','"'+next.metadata.version+'"').expect(200)).body.data;assert.ok(fixed.meetings[0].id);assert.equal(fixed.metadata.dataStatus,'draft');
 await request(app).post('/api/churches/'+c._id+'/meeting-identifiers').set(auth('admin')).set('If-Match','"'+next.metadata.version+'"').expect(409);
});


test('Sección independiente de categoría, orden conservado y validación',async()=>{
 const photo=section=>({type:'image',category:'logo',section,frame:'square',url:'https://example.test/'+section+'.png',source:'Propia'});
 const c=(await create('rep',{media:[photo('meetings'),photo('recommendation'),photo('facilities')]}).expect(201)).body.data;await status(c,'published').expect(200);
 const pub=(await request(app).get('/api/communities/'+c._id).expect(200)).body.data;assert.deepEqual(pub.media.map(m=>m.section),['meetings','recommendation','facilities']);assert.ok(pub.media.every(m=>m.category==='logo'));
 await create('rep',{media:[photo('unknown')]}).expect(400);await create('rep',{media:[photo('representatives')]}).expect(400);
});
