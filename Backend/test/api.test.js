const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');
const execFileAsync = require('node:util').promisify(execFile);
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model'), Church = require('../src/models/church.model');
const Interaction = require('../src/models/interaction.model');
const config = { jwtSecret: 'a-test-only-secret-with-more-than-32-characters', corsOrigins: ['http://localhost:5173'], recommenderUrl: null, recommenderTimeoutMs: 100 };
const app = createApp(config);
let mongo, admin, rep, other, person, adminToken, repToken, otherToken, userToken, nearId, farId;
const bearer = token => ({ Authorization: 'Bearer ' + token });
const fixture = (name, point = [-70.65, -33.45]) => ({
  identification: { name, description: 'Comunidad sintética' }, verification: { authorized: true, source: 'test-fixture' },
  location: { address: 'Dirección de prueba', commune: 'Santiago', coordinates: { type: 'Point', coordinates: point } },
  christianIdentity: { branch: 'Protestante', denomination: 'Bautista', languages: ['Español'] },
  doctrine: { officialStatement: 'Declaración institucional de prueba', characteristics: ['Formación bíblica'] },
  meetings: [{ type: 'Culto', modality: 'Presencial', schedule: [{ day: 'Domingo', startTime: '10:00', durationMinutes: 90 }] }],
  community: { activities: ['Jóvenes'] }, leadership: { mainLeader: { name: 'Responsable', role: 'Pastor' } }
});
async function account(email, role) {
  const response = await request(app).post('/api/auth/register').send({ email, password: 'password-for-tests-123' }).expect(201);
  const user = await User.findById(response.body.data.id); user.role = role; await user.save();
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password-for-tests-123' }).expect(200);
  return [user, login.body.token];
}
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12', downloadDir: path.resolve(__dirname, '../.cache/mongodb') } });
  await connectDB(mongo.getUri('koinonia_test'));
  [admin, adminToken] = await account('admin@example.test', 'admin');
  [rep, repToken] = await account('rep@example.test', 'representative');
  [other, otherToken] = await account('other@example.test', 'representative');
  [person, userToken] = await account('user@example.test', 'user');
}, { timeout: 240000 });
after(async () => { await disconnectDB(); if (mongo) await mongo.stop(); });

test('Registro: hash, normalización, duplicados y rechazo de escalamiento de rol', async () => {
  await request(app).post('/api/auth/register').send({ email: 'evil@example.test', password: 'password-for-tests-123', role: 'admin' }).expect(400);
  await request(app).post('/api/auth/register').send({ email: 'USER@EXAMPLE.TEST', password: 'password-for-tests-123' }).expect(409);
  const dbUser = await User.findById(person.id).select('+password');
  assert.notEqual(dbUser.password, 'password-for-tests-123');
  const profile = await request(app).get('/api/users/me').set(bearer(userToken)).expect(200);
  assert.equal(profile.body.data.password, undefined); assert.equal(profile.body.data.role, 'user');
});
test('Autenticación: exige Bearer, rechaza tokens falsos y credenciales erróneas', async () => {
  await request(app).get('/api/users/me').expect(401);
  await request(app).get('/api/users/me').set('Authorization', userToken).expect(401);
  await request(app).get('/api/users/me').set(bearer('forged')).expect(401);
  await request(app).post('/api/auth/login').send({ email: person.email, password: 'wrong' }).expect(401);
});
test('Roles: solo admin; rol actual se consulta en BD aunque el token sea anterior', async () => {
  await request(app).patch('/api/users/' + other.id + '/role').set(bearer(userToken)).send({ role: 'admin' }).expect(403);
  await request(app).patch('/api/users/' + other.id + '/role').set(bearer(adminToken)).send({ role: 'user' }).expect(200);
  await request(app).post('/api/churches').set(bearer(otherToken)).send(fixture('No permitido')).expect(403);
  await request(app).patch('/api/users/' + other.id + '/role').set(bearer(adminToken)).send({ role: 'representative' }).expect(200);
  await request(app).patch('/api/users/' + admin.id + '/role').set(bearer(adminToken)).send({ role: 'user' }).expect(409);
});
test('Comunidades: borradores privados, publicación y aislamiento por representante', async () => {
  await request(app).post('/api/churches').set(bearer(userToken)).send(fixture('Sin permisos')).expect(403);
  const created = await request(app).post('/api/churches').set(bearer(adminToken)).send(fixture('Comunidad cercana')).expect(201);
  nearId = created.body.data._id;
  await request(app).put('/api/churches/' + nearId + '/representatives').set(bearer(adminToken)).send({ userIds: [rep.id] }).expect(200);
  await request(app).get('/api/churches/' + nearId).expect(404);
  await request(app).put('/api/churches/' + nearId).set(bearer(otherToken)).send(fixture('Intruso')).expect(403);
  await request(app).delete('/api/churches/' + nearId).set(bearer(otherToken)).expect(403);
  await request(app).patch('/api/churches/' + nearId + '/status').set(bearer(repToken)).send({ status: 'verified' }).expect(403);
  await request(app).patch('/api/churches/' + nearId + '/status').set(bearer(adminToken)).send({ status: 'verified' }).expect(200);
  const found = await request(app).get('/api/churches/' + nearId).expect(200);
  assert.equal(found.body.data.representatives, undefined);
  assert.equal(found.body.data.verification.representativeName, undefined);
  assert.equal(found.body.data.verification.source, undefined);
  const mine = await request(app).get('/api/churches/manage').set(bearer(otherToken)).expect(200);
  assert.equal(mine.body.data.length, 0);
});
test('Validación: coordenadas, horarios, objetos de consulta y campos reservados', async () => {
  const bad = fixture('Inválida', [190, 0]);
  await request(app).post('/api/churches').set(bearer(adminToken)).send(bad).expect(400);
  const time = fixture('Horario inválido'); time.meetings[0].schedule[0].startTime = '25:70';
  await request(app).post('/api/churches').set(bearer(adminToken)).send(time).expect(400);
  await request(app).post('/api/churches').set(bearer(adminToken)).send({ ...fixture('Escalamiento'), representatives: [other.id] }).expect(400);
  await request(app).get('/api/churches?denomination[$ne]=x').expect(400);
  await request(app).get('/api/churches/nearby?lat=-33').expect(400);
  await request(app).get('/api/churches/nearby?lat=&lng=1').expect(400);
  await request(app).get('/api/churches?limit=5000').expect(400);
  await request(app).get('/api/churches/no-es-id').expect(400);
});
test('Geografía real: radio en km, orden por distancia y filtros combinados', async () => {
  const create = await request(app).post('/api/churches').set(bearer(adminToken)).send(fixture('Comunidad lejana', [-70.65, -33.65])).expect(201);
  farId = create.body.data._id;
  await request(app).put('/api/churches/' + farId + '/representatives').set(bearer(adminToken)).send({ userIds: [rep.id] }).expect(200);
  await request(app).patch('/api/churches/' + farId + '/status').set(bearer(adminToken)).send({ status: 'published' }).expect(200);
  const found = await request(app).get('/api/churches/nearby?lat=-33.45&lng=-70.65&radius=5&denomination=bautista').expect(200);
  assert.deepEqual(found.body.data.map(c => c._id), [nearId]);
  assert.ok(found.body.data[0].distanceMeters < 1);
  const wide = await request(app).get('/api/churches/nearby?lat=-33.45&lng=-70.65&radius=50').expect(200);
  assert.deepEqual(wide.body.data.map(c => c._id), [nearId, farId]);
  assert.ok(wide.body.data[1].distanceMeters > 20000);
  const none = await request(app).get('/api/churches/search?activity=Inexistente').expect(200);
  assert.equal(none.body.pagination.total, 0);
  const literal = await request(app).get('/api/churches/search?q=.*').expect(200);
  assert.equal(literal.body.data.length, 0);
});
test('Interacciones: upsert idempotente, exclusión mutua y aislamiento por usuario', async () => {
  for (let i = 0; i < 2; i++) await request(app).post('/api/interactions').set(bearer(userToken)).send({ churchId: nearId, type: 'saved' }).expect(200);
  assert.equal(await Interaction.countDocuments({ user: person.id, church: nearId }), 1);
  await request(app).post('/api/interactions').set(bearer(userToken)).send({ churchId: nearId, type: 'discarded', reason: 'No coincide con mi búsqueda' }).expect(200);
  const own = await request(app).get('/api/users/me/interactions?type=discarded').set(bearer(userToken)).expect(200);
  assert.equal(own.body.data.length, 1);
  const foreign = await request(app).get('/api/users/me/interactions').set(bearer(otherToken)).expect(200);
  assert.equal(foreign.body.data.length, 0);
  await request(app).delete('/api/interactions/' + nearId).set(bearer(otherToken)).expect(204);
  assert.equal(await Interaction.countDocuments({ user: person.id, church: nearId }), 1);
});
test('Recomendaciones: respeta radio, preferencias y descartes; declara ausencia de LLM', async () => {
  const input = { location: { lat: -33.45, lng: -70.65 }, preferences: { radiusKm: 5, denominations: ['Bautista'] }, query: 'Quiero actividades juveniles' };
  const discarded = await request(app).post('/api/recommendations').set(bearer(userToken)).send(input).expect(200);
  assert.equal(discarded.body.data.length, 0);
  await request(app).delete('/api/interactions/' + nearId).set(bearer(userToken)).expect(204);
  const result = await request(app).post('/api/recommendations').set(bearer(userToken)).send(input).expect(200);
  assert.deepEqual(result.body.data.map(r => r.churchId), [nearId]);
  assert.equal(result.body.meta.mode, 'deterministic'); assert.equal(result.body.meta.queryInterpreted, false);
  assert.ok(result.body.data[0].score >= 0 && result.body.data[0].score <= 1);
  const mismatch = await request(app).post('/api/recommendations').set(bearer(userToken)).send({ preferences: { denominations: ['Otra'] } }).expect(200);
  assert.equal(mismatch.body.data.length, 0);
});
test('Preferencias: persisten y no permiten cambios de rol', async () => {
  await request(app).put('/api/users/me/preferences').set(bearer(userToken)).send({ role: 'admin' }).expect(400);
  await request(app).put('/api/users/me/preferences').set(bearer(userToken)).send({ radiusKm: 5, location: { lat: -33.45, lng: -70.65 }, denominations: ['Bautista'] }).expect(200);
  const result = await request(app).post('/api/recommendations').set(bearer(userToken)).send({}).expect(200);
  assert.deepEqual(result.body.data.map(r => r.churchId), [nearId]);
});
test('Fuentes: aprobación explícita y rechazo de candidatos o evidencias inventadas', async () => {
  const created = await request(app).post('/api/churches/' + nearId + '/sources').set(bearer(repToken))
    .send({ title: 'Fuente institucional', text: 'Reuniones juveniles declaradas.', kind: 'institutional' }).expect(201);
  const sourceId = created.body.data._id;
  const pending = await request(app).get('/api/churches/' + nearId + '/sources').expect(200);
  assert.equal(pending.body.data.length, 0);
  await request(app).patch('/api/sources/' + sourceId + '/status').set(bearer(adminToken)).send({ status: 'approved' }).expect(200);
  let mode = 'valid', received;
  const server = http.createServer((req, res) => {
    let data = ''; req.on('data', chunk => data += chunk);
    req.on('end', () => {
      received = JSON.parse(data);
      if (mode === 'slow') return setTimeout(() => res.end('{}'), 300);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ engine: 'rag', results: [{ churchId: mode === 'foreign' ? farId : nearId, explanation: 'Fuente institucional recuperada.',
        sourceIds: mode === 'invented' ? ['000000000000000000000999'] : [sourceId] }] }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.recommenderUrl = 'http://127.0.0.1:' + server.address().port;
  try {
    const good = await request(app).post('/api/recommendations').set(bearer(userToken)).send({}).expect(200);
    assert.deepEqual(good.body.data[0].sourceIds, [sourceId]); assert.equal(received.version, '1');
    assert.equal(received.candidates[0].sources[0].id, sourceId);
    assert.equal(received.email, undefined); assert.equal(received.candidates[0].representatives, undefined);
    mode = 'foreign'; await request(app).post('/api/recommendations').set(bearer(userToken)).send({}).expect(502);
    mode = 'invented'; await request(app).post('/api/recommendations').set(bearer(userToken)).send({}).expect(502);
    mode = 'slow'; await request(app).post('/api/recommendations').set(bearer(userToken)).send({}).expect(503);
  } finally { config.recommenderUrl = null; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
test('Publicación: exige ficha completa y editar conserva la visibilidad', async () => {
  const incomplete = await request(app).post('/api/churches').set(bearer(adminToken))
    .send({ identification: { name: 'Incompleta' }, location: fixture('x').location }).expect(201);
  await request(app).patch('/api/churches/' + incomplete.body.data._id + '/status').set(bearer(adminToken)).send({ status: 'published' }).expect(400);
  const edited = await request(app).put('/api/churches/' + nearId).set(bearer(repToken)).send(fixture('Editada')).expect(200);
  assert.equal(edited.body.data.metadata.dataStatus, 'published');
  await request(app).get('/api/churches/' + nearId).expect(200);
  await request(app).patch('/api/churches/' + nearId + '/status').set(bearer(adminToken)).send({ status: 'published' }).expect(200);
});
test('Desactivación: oculta comunidad de búsquedas y rechaza nuevas interacciones', async () => {
  await request(app).delete('/api/churches/' + nearId).set(bearer(adminToken)).expect(204);
  await request(app).get('/api/churches/' + nearId).expect(404);
  await request(app).post('/api/interactions').set(bearer(userToken)).send({ churchId: nearId, type: 'saved' }).expect(404);
  assert.equal((await Church.findById(nearId)).active, false);
});
test('Asignación de representantes: solo admin y sin aceptar usuarios sin rol autorizado', async () => {
  await request(app).put('/api/churches/' + farId + '/representatives').set(bearer(repToken)).send({ userIds: [other.id] }).expect(403);
  await request(app).put('/api/churches/' + farId + '/representatives').set(bearer(adminToken)).send({ userIds: [person.id] }).expect(400);
  await request(app).put('/api/churches/' + farId + '/representatives').set(bearer(adminToken)).send({ userIds: [other.id] }).expect(200);
  await request(app).put('/api/churches/' + farId).set(bearer(repToken)).send(fixture('Ya no es mía')).expect(403);
  await request(app).put('/api/churches/' + farId).set(bearer(otherToken)).send(fixture('Ahora administrada por otro')).expect(200);
});
test('Scripts operativos: asignación de rol y seed repetible sin sobrescritura', async () => {
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, MONGO_URI: mongo.getUri('koinonia_test'), JWT_SECRET: config.jwtSecret, NODE_ENV: 'test' };
  await execFileAsync(process.execPath, ['scripts/set-role.js', rep.email, 'representative'], { cwd, env });
  await assert.rejects(execFileAsync(process.execPath, ['scripts/seed.js', admin.email, '--confirm-demo'], { cwd, env }), /Solo bases/);
  const db = require('mongoose').connection.getClient().db('koinonia_seed_demo');
  await db.collection('users').insertOne({ ...admin.toObject(), password: 'not-used-by-seed' });
  const demoEnv = { ...env, MONGO_URI: mongo.getUri('koinonia_seed_demo') };
  await assert.rejects(execFileAsync(process.execPath, ['scripts/seed.js', 'missing@example.test', '--confirm-demo'], { cwd, env: demoEnv }), /administrador activo existente/);
  assert.equal(await db.collection('users').countDocuments({ email: 'missing@example.test' }), 0);
  for (let i = 0; i < 2; i++) await execFileAsync(process.execPath, ['scripts/seed.js', admin.email, '--confirm-demo'], { cwd, env: demoEnv });
  assert.equal(await db.collection('churches').countDocuments(), 3);
  await db.collection('churches').updateOne({}, { $set: { 'identification.description': 'Conservar edición' } });
  await execFileAsync(process.execPath, ['scripts/seed.js', admin.email, '--confirm-demo'], { cwd, env: demoEnv });
  assert.equal(await db.collection('churches').countDocuments({ 'identification.description': 'Conservar edición' }), 1);
});
test('Panel de pruebas: recursos locales y desactivación explícita', async () => {
  await request(app).get('/').expect(302).expect('Location', '/testing/');
  const html = await request(app).get('/testing/').expect(200);
  assert.match(html.text, /Test de servicios/);
  assert.match(html.headers['content-security-policy'], /script-src 'self'/);
  await request(app).get('/testing/app.js').expect(200);
  await request(createApp({ ...config, enableTestUi: false })).get('/testing/').expect(404);
});
test('Gestión completa: filtros privados, ficha inactiva, restauración y conflicto entre sesiones', async () => {
  await request(app).get('/api/churches/manage/' + nearId).expect(401);
  await request(app).get('/api/churches/manage/' + nearId).set(bearer(otherToken)).expect(403);
  const inactive = await request(app).get('/api/churches/manage?active=inactive&q=Editada').set(bearer(adminToken)).expect(200);
  assert.equal(inactive.body.data.length, 1);
  const detail = await request(app).get('/api/churches/manage/' + nearId).set(bearer(repToken)).expect(200);
  assert.equal(detail.body.data.active, false);
  const version = '"' + detail.body.data.metadata.version + '"';
  await request(app).post('/api/churches/' + nearId + '/restore').set(bearer(otherToken)).expect(403);
  const restored = await request(app).post('/api/churches/' + nearId + '/restore').set(bearer(adminToken)).set('If-Match', version).expect(200);
  assert.equal(restored.body.data.metadata.dataStatus, 'draft');
  await request(app).get('/api/churches/' + nearId).expect(404);
  const currentVersion = '"' + restored.body.data.metadata.version + '"';
  await request(app).put('/api/churches/' + nearId).set(bearer(repToken)).set('If-Match', version).send(fixture('Cambio obsoleto')).expect(409);
  const updated = await request(app).put('/api/churches/' + nearId).set(bearer(repToken)).set('If-Match', currentVersion).send(fixture('Actualizada con versión')).expect(200);
  assert.equal(updated.body.data.identification.name, 'Actualizada con versión');
  await request(app).delete('/api/churches/' + nearId).set(bearer(adminToken)).set('If-Match', currentVersion).expect(409);
  await request(app).patch('/api/churches/' + nearId + '/status').set(bearer(adminToken)).set('If-Match', currentVersion).send({ status: 'published' }).expect(409);
  await request(app).get('/api/churches/manage?active=wrong').set(bearer(adminToken)).expect(400);
  const matching = await request(app).get('/api/churches/manage?status=draft&q=Actualizada&commune=Santiago&denomination=Bautista').set(bearer(repToken)).expect(200);
  assert.equal(matching.body.pagination.total, 1);
  assert.equal(matching.body.pagination.pages, 1);
});
test('Errores JSON, 404 y cuenta desactivada', async () => {
  await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad').expect(400);
  await request(app).get('/api/unknown').expect(404);
  await User.updateOne({ _id: person.id }, { $set: { active: false } });
  await request(app).get('/api/users/me').set(bearer(userToken)).expect(401);
});

test('Encuesta: avance parcial, estados, reanudación y concurrencia', async () => {
  const [onboard, token] = await account('onboard@example.test', 'user');
  const headers = bearer(token);
  let r = await request(app).patch('/api/users/me').set(headers).send({ preferences: { denominations: ['Bautista'], meetingDays: ['Domingo', 'Sábado'] }, searchContext: { goal: 'join' }, onboarding: { lastStep: 3 } }).expect(200);
  assert.equal(r.body.data.criterionModes.denominations, 'preferred');
  assert.equal(r.body.data.onboarding.status, 'pending');
  assert.equal(r.body.data.answerStates.denominations, 'answered');
  const revision = r.body.data.profileRevision;
  r = await request(app).patch('/api/users/me').set(headers).send({ preferences: { languages: ['Español'] }, onboarding: { status: 'skipped' }, expectedRevision: revision }).expect(200);
  assert.deepEqual(r.body.data.preferences.denominations, ['Bautista']);
  assert.equal(r.body.data.searchContext.goal, 'join');
  await request(app).patch('/api/users/me').set(headers).send({ expectedRevision: revision, onboarding: { status: 'completed' } }).expect(409);
  r = await request(app).patch('/api/users/me').set(headers).send({ answerStates: { denominations: 'unknown', languages: 'no_preference' }, onboarding: { status: 'completed', lastStep: 7 } }).expect(200);
  assert.equal(r.body.data.criterionModes.denominations, 'disabled');
  assert.ok(!r.body.data.preferences.denominations?.length);
  assert.equal(r.body.data.answerStates.languages, 'no_preference');
  assert.ok(r.body.data.onboarding.completedAt);
  const resumed = await request(app).get('/api/users/me').set(headers).expect(200);
  assert.deepEqual(resumed.body.data, r.body.data);
  assert.equal((await User.findById(onboard.id)).email, 'onboard@example.test');
});

test('Perfil: rechaza escalamiento, estados contradictorios y radio sin ubicación', async () => {
  await User.updateOne({ _id: person._id }, { $set: { active: true } });
  const headers = bearer(userToken);
  for (const body of [ { role: 'admin' }, { userId: other.id }, { searchContext: { goal: 'invalid' } },
    { onboarding: { status: 'invalid' } }, { onboarding: { completedAt: '2026-01-01' } },
    { preferences: { meetingDays: ['Sunday'] } }, { criterionModes: { activities: 'exclude' } },
    { preferences: { languages: ['Español'] }, answerStates: { languages: 'unknown' } },
    { preferences: { location: null, radiusKm: 10 }, criterionModes: { radiusKm: 'required' } },
    { preferences: { ministries: [] }, criterionModes: { ministries: 'required' } } ]) {
    await request(app).patch('/api/users/me').set(headers).send(body).expect(400);
  }
  await request(app).patch('/api/users/me').send({ searchContext: { goal: 'join' } }).expect(401);
});

test('Perfil: aislamiento, campos privados y compatibilidad con documentos antiguos', async () => {
  const before = await User.findById(other.id).lean();
  await request(app).patch('/api/users/' + other.id).set(bearer(userToken)).send({ searchContext: { goal: 'join' } }).expect(404);
  await request(app).patch('/api/users/me').set(bearer(userToken)).send({ searchContext: { goal: 'explore' } }).expect(200);
  assert.deepEqual((await User.findById(other.id).lean()).searchContext, before.searchContext);
  const profile = await request(app).get('/api/users/me').set(bearer(userToken)).expect(200);
  assert.equal(profile.body.data.password, undefined);
  await User.collection.updateOne({ _id: other._id }, { $unset: { profileRevision: '', onboarding: '', criterionModes: '', answerStates: '', searchContext: '' } });
  const old = await request(app).get('/api/users/me').set(bearer(otherToken)).expect(200);
  assert.equal(old.body.data.onboarding.status, 'pending');
  assert.equal(old.body.data.profileRevision, 0);
  await request(app).patch('/api/users/me').set(bearer(otherToken)).send({ searchContext: { goal: 'connect' }, expectedRevision: 0 }).expect(200);
  assert.equal((await User.findById(other.id)).email, other.email);
});

test('Criterios: deseables, obligatorios, desactivados y datos desconocidos', async () => {
  const [, token] = await account('criteria@example.test', 'user'), headers = bearer(token);
  const known = await Church.create({ ...fixture('Criterios con ministerio'), community: { ministries: ['Jóvenes'] }, createdBy: admin._id, metadata: { dataStatus: 'published' } });
  const unknown = await Church.create({ ...fixture('Criterios sin información'), community: {}, createdBy: admin._id, metadata: { dataStatus: 'published' } });
  try {
    await request(app).patch('/api/users/me').set(headers).send({ preferences: { ministries: ['Jóvenes'] }, criterionModes: { ministries: 'preferred', radiusKm: 'disabled' } }).expect(200);
    let r = await request(app).post('/api/recommendations').set(headers).send({ limit: 20 }).expect(200);
    assert.equal(r.body.data.find(x => x.churchId === unknown.id).criteria.ministries.status, 'unknown');
    assert.equal(r.body.data.find(x => x.churchId === known.id).criteria.ministries.status, 'matched');
    r = await request(app).post('/api/recommendations').set(headers).send({ criterionModes: { ministries: 'required' } }).expect(200);
    assert.deepEqual(r.body.data.map(x => x.churchId), [known.id]);
    r = await request(app).post('/api/recommendations').set(headers).send({ criterionModes: { ministries: 'disabled' } }).expect(200);
    assert.ok(r.body.data.some(x => x.churchId === unknown.id));
    assert.equal(r.body.data[0].criteria.ministries, undefined);
    assert.equal((await request(app).get('/api/users/me').set(headers)).body.data.criterionModes.ministries, 'preferred');
    await request(app).post('/api/interactions').set(headers).send({ churchId: known.id, type: 'discarded' }).expect(200);
    r = await request(app).post('/api/recommendations').set(headers).send({ criterionModes: { ministries: 'required' } }).expect(200);
    assert.equal(r.body.data.length, 0);
  } finally { await Church.deleteMany({ _id: { $in: [known._id, unknown._id] } }); }
});

test('Ranking personalizado evalúa más de 100 candidatos y distingue radio deseable de obligatorio', async () => {
  const rows = await Church.insertMany(Array.from({ length: 102 }, (_, i) => ({ ...fixture('Cobertura ' + i, i === 101 ? [-70.65, -33.65] : [-70.65, -33.45]),
    community: { activities: ['Prueba cobertura'], ministries: i === 101 ? ['Ministerio único'] : [] },
    createdBy: admin._id, metadata: { dataStatus: 'published' } })));
  const headers = bearer(otherToken);
  try {
    const input = { preferences: { activities: ['Prueba cobertura'], ministries: ['Ministerio único'], radiusKm: 5 },
      criterionModes: { activities: 'required', ministries: 'preferred', radiusKm: 'disabled' }, limit: 1 };
    let r = await request(app).post('/api/recommendations').set(headers).send(input).expect(200);
    assert.equal(r.body.data[0].churchId, rows[101].id);
    assert.equal(r.body.meta.evaluatedCandidates, 102); assert.equal(r.body.meta.truncated, false);
    input.location = { lat: -33.45, lng: -70.65 };
    input.criterionModes = { activities: 'required', ministries: 'required', radiusKm: 'preferred' };
    r = await request(app).post('/api/recommendations').set(headers).send(input).expect(200);
    assert.equal(r.body.data[0].churchId, rows[101].id);
    assert.ok(r.body.data[0].church.distanceMeters > 20000);
    input.criterionModes.radiusKm = 'required';
    r = await request(app).post('/api/recommendations').set(headers).send(input).expect(200);
    assert.equal(r.body.data.length, 0);
    const day = await request(app).patch('/api/users/me').set(headers).send({ preferences: { meetingDay: 'Domingo' } }).expect(200);
    assert.equal(day.body.data.preferences.meetingDay, 'Domingo');
    const multi = await request(app).patch('/api/users/me').set(headers).send({ preferences: { meetingDays: ['Sábado', 'Domingo'] }, criterionModes: { meetingDays: 'required' } }).expect(200);
    assert.equal(multi.body.data.preferences.meetingDay, undefined);
    const result = await request(app).post('/api/recommendations').set(headers).send({ preferences: { activities: ['Prueba cobertura'] } }).expect(200);
    assert.ok(result.body.data.length > 0);
  } finally { await Church.deleteMany({ _id: { $in: rows.map(x => x._id) } }); }
});

test('Encuesta v2: cuatro pasos, dirección privada y validación de versión', async () => {
  const headers = bearer(otherToken);
  await request(app).patch('/api/users/me').set(headers).send({ onboarding: {version:2,status:'pending',lastStep:0},searchContext:{address:'Referencia privada 123'} }).expect(200);
  let r = await request(app).get('/api/users/me').set(headers).expect(200);
  assert.equal(r.body.data.searchContext.address,'Referencia privada 123');
  const stranger = await request(app).get('/api/users/me').set(bearer(userToken)).expect(200);
  assert.notEqual(stranger.body.data.searchContext?.address,'Referencia privada 123');
  await request(app).patch('/api/users/me').set(headers).send({ onboarding:{version:2,lastStep:5} }).expect(400);
  await request(app).patch('/api/users/me').set(headers).send({ onboarding:{version:4,lastStep:1} }).expect(400);
  await request(app).patch('/api/users/me').set(headers).send({ searchContext:{address:'x'.repeat(201)} }).expect(400);
  await request(app).patch('/api/users/me').set(headers).send({ preferences:{radiusKm:10,location:null},criterionModes:{radiusKm:'required'} }).expect(400);
  r = await request(app).patch('/api/users/me').set(headers).send({ onboarding:{version:2,status:'completed',lastStep:4},answerStates:{address:'no_preference'} }).expect(200);
  assert.equal(r.body.data.searchContext.address,undefined);assert.equal(r.body.data.onboarding.lastStep,4);
  assert.ok(r.body.data.onboarding.completedAt);
});


test('Administración: creación, baja, restauración y búsqueda de representantes exclusivas de admin', async () => {
  await request(app).post('/api/churches').set(bearer(repToken)).send(fixture('Prohibida')).expect(403);
  await request(app).delete('/api/churches/' + nearId).set(bearer(repToken)).expect(403);
  await request(app).post('/api/churches/' + nearId + '/restore').set(bearer(repToken)).expect(403);
  await request(app).get('/api/representatives?email=rep@example.test').set(bearer(repToken)).expect(403);
  await request(app).get('/api/churches/manage').set(bearer(userToken)).expect(403);
  await request(app).get('/api/churches/manage/' + nearId).set(bearer(otherToken)).expect(403);
  const eligible = await request(app).get('/api/representatives?email=rep@example.test').set(bearer(adminToken)).expect(200);
  assert.equal(eligible.body.data[0]._id, rep.id);
  assert.equal(eligible.body.data[0].preferences, undefined);
  assert.equal(eligible.body.data[0].password, undefined);
  const data = fixture('Matices de ficha'); data.location.accessibilityLevel = 'partial'; data.location.parkingAvailability = 'nearby';
  data.firstVisit = { welcomeSupport: 'partial' }; data.meetings[0].frequencyNotes = 'Primer domingo de cada mes';
  const created = await request(app).post('/api/churches').set(bearer(adminToken)).send(data).expect(201);
  assert.equal(created.body.data.location.accessibilityLevel, 'partial');
  assert.equal(created.body.data.meetings[0].frequencyNotes, 'Primer domingo de cada mes');
});


test('Encuesta v3: identidad espiritual privada, tres fases y distancia heredada', async () => {
  await User.updateOne({_id:person.id},{$set:{'preferences.radiusKm':20,'criterionModes.radiusKm':'required'},$unset:{'preferences.location':1}});
  const r = await request(app).patch('/api/users/me').set(bearer(userToken)).send({searchContext:{spiritualIdentity:'believer'},onboarding:{version:3,lastStep:3,status:'completed'}}).expect(200);
  assert.equal(r.body.data.searchContext.spiritualIdentity,'believer');
  await request(app).patch('/api/users/me').set(bearer(userToken)).send({onboarding:{version:3,lastStep:4}}).expect(400);
  await request(app).patch('/api/users/me').set(bearer(userToken)).send({preferences:{radiusKm:25},criterionModes:{radiusKm:'required'}}).expect(400);
});
test('Representantes: admin crea rol fijo, contraseña hash y lista sin secretos', async () => {
  const body={name:'Representante nuevo',email:'representante-new@example.test',position:'Encargado'};
  await request(app).post('/api/representatives').set(bearer(repToken)).send(body).expect(403);
  await request(app).post('/api/representatives').set(bearer(adminToken)).send({...body,role:'admin'}).expect(400);
  const r=await request(app).post('/api/representatives').set(bearer(adminToken)).send(body).expect(201);
  assert.equal(r.body.data.role,'representative');assert.ok(r.body.initialPassword.length>=12);
  const stored=await User.findById(r.body.data._id).select('+password');assert.notEqual(stored.password,r.body.initialPassword);
  await request(app).post('/api/auth/login').send({email:body.email,password:r.body.initialPassword}).expect(200);
  await request(app).post('/api/representatives').set(bearer(adminToken)).send(body).expect(409);
  const list=await request(app).get('/api/representatives?limit=1&page=1').set(bearer(adminToken)).expect(200);
  assert.equal(list.body.data.length,1);assert.ok(list.body.pagination.total>=3);assert.equal(list.body.data[0].password,undefined);
});


test('Privacidad institucional: ficha, listado, cercanía y recomendaciones omiten campos marcados', async () => {
  const body=fixture('Ficha privacidad');body.doctrine.soteriology='Postura reservada S';body.doctrine.eschatology='Postura reservada E';body.contact={email:'reservado@example.test',phone:'123456789'};
  body.meetings=[];body.privateFields={soteriology:true,eschatology:true,email:true,phone:true};body.meetingTypes=['Grupo pequeño / célula','Reunión de oración'];
  const created=await request(app).post('/api/churches').set(bearer(adminToken)).send(body).expect(201),id=created.body.data._id;
  await request(app).patch('/api/churches/'+id+'/status').set(bearer(adminToken)).send({status:'published'}).expect(200);
  const privateResult=await request(app).get('/api/churches/manage/'+id).set(bearer(adminToken)).expect(200);
  assert.equal(privateResult.body.data.contact.email,body.contact.email);
  for(const path of ['/api/churches/'+id,'/api/churches/search?q=Ficha%20privacidad','/api/churches/nearby?lat=-33.45&lng=-70.65&radius=1&q=Ficha%20privacidad']){
    const r=await request(app).get(path).expect(200),c=Array.isArray(r.body.data)?r.body.data[0]:r.body.data;
    assert.equal(c.contact.email,undefined);assert.equal(c.contact.phone,undefined);assert.equal(c.doctrine.soteriology,undefined);assert.equal(c.doctrine.eschatology,undefined);assert.equal(c.privateFields,undefined);assert.equal(c.meetingTypes.length,2);
  }
  const recommendations=await request(app).post('/api/recommendations').set(bearer(adminToken)).send({limit:20}).expect(200);
  const recommended=recommendations.body.data.find(x=>x.churchId===id);assert.ok(recommended);assert.equal(recommended.church.contact.email,undefined);assert.equal(recommended.church.doctrine.soteriology,undefined);
  await request(app).post('/api/interactions').set(bearer(adminToken)).send({churchId:id,type:'saved'}).expect(200);
  const saved=await request(app).get('/api/users/me/interactions?type=saved').set(bearer(adminToken)).expect(200);assert.equal(saved.body.data.find(x=>x.church._id===id).church.contact.email,undefined);
  const {publicChurch}=require('../src/services/church.service');
  const raw={...body,externalProfile:{emails:['reservado@example.test'],phones:['123456789']}};
  const pub=publicChurch(raw);assert.equal(pub.externalProfile.emails,undefined);assert.equal(raw.contact.email,'reservado@example.test');
  const oldClient={...body};delete oldClient.privateFields;delete oldClient.meetingTypes;
  await request(app).put('/api/churches/'+id).set(bearer(adminToken)).send(oldClient).expect(200);
  assert.equal((await Church.findById(id)).privateFields.email,true);
  body.privateFields={soteriology:false,eschatology:false,email:false,phone:false};
  await request(app).put('/api/churches/'+id).set(bearer(adminToken)).send(body).expect(200);
  await request(app).patch('/api/churches/'+id+'/status').set(bearer(adminToken)).send({status:'published'}).expect(200);
  const pubAgain=await request(app).get('/api/churches/'+id).expect(200);assert.equal(pubAgain.body.data.contact.email,body.contact.email);
});
test('Consulta y promoción: solo admin, sin datos privados ni descenso de administradores', async () => {
  await request(app).get('/api/users/lookup?email=user@example.test').set(bearer(repToken)).expect(403);
  const found=await request(app).get('/api/users/lookup?email=user@example.test').set(bearer(adminToken)).expect(200);
  assert.equal(found.body.data._id,person.id);assert.equal(found.body.data.preferences,undefined);assert.equal(found.body.data.password,undefined);
  const missing=await request(app).get('/api/users/lookup?email=missing@example.test').set(bearer(adminToken)).expect(200);assert.equal(missing.body.data,null);
  await request(app).post('/api/users/'+person.id+'/promote-representative').set(bearer(repToken)).send({}).expect(403);
  await request(app).post('/api/users/'+admin.id+'/promote-representative').set(bearer(adminToken)).send({}).expect(409);
  await request(app).post('/api/users/'+person.id+'/promote-representative').set(bearer(adminToken)).send({}).expect(200);
  await request(app).post('/api/users/'+person.id+'/promote-representative').set(bearer(adminToken)).send({}).expect(409);
  assert.equal((await User.findById(person.id)).role,'representative');
});


test('Gestión de usuarios: filtro, privacidad, edición, concurrencia y protección del acceso propio', async () => {
  await request(app).get('/api/users/manage').set(bearer(repToken)).expect(403);
  await request(app).get('/api/users/manage').expect(401);
  const list=await request(app).get('/api/users/manage?q=admin@example.test&role=admin&active=active').set(bearer(adminToken)).expect(200);
  assert.equal(list.body.pagination.total,1);assert.equal(list.body.data[0].password,undefined);assert.equal(list.body.data[0].searchContext,undefined);
  const nobody=await request(app).get('/api/users/manage?q=.*').set(bearer(adminToken)).expect(200);assert.equal(nobody.body.pagination.total,0);
  const self=list.body.data[0],body={name:'Nombre',position:'Cargo',role:'user',active:true,expectedUpdatedAt:self.updatedAt};
  await request(app).patch('/api/users/manage/'+admin.id).set(bearer(adminToken)).send(body).expect(409);
  await request(app).patch('/api/users/manage/'+admin.id).set(bearer(adminToken)).send({...body,role:'admin',active:false}).expect(409);
  const target=(await request(app).get('/api/users/manage?q=other@example.test').set(bearer(adminToken)).expect(200)).body.data[0];
  const input={...body,expectedUpdatedAt:target.updatedAt};
  await request(app).patch('/api/users/manage/'+target._id).set(bearer(repToken)).send(input).expect(403);
  await request(app).patch('/api/users/manage/'+target._id).set(bearer(adminToken)).send({...input,password:'forbidden'}).expect(400);
  const changed=await request(app).patch('/api/users/manage/'+target._id).set(bearer(adminToken)).send({...input,active:false}).expect(200);
  await request(app).get('/api/users/me').set(bearer(otherToken)).expect(401);
  await request(app).patch('/api/users/manage/'+target._id).set(bearer(adminToken)).send(input).expect(409);
  await request(app).patch('/api/users/manage/'+target._id).set(bearer(adminToken)).send({...input,role:'representative',expectedUpdatedAt:changed.body.data.updatedAt}).expect(200);
  await request(app).get('/api/churches/manage').set(bearer(otherToken)).expect(200);
});


test('Descubrimiento: modo tradicional independiente del proveedor y capacidades públicas honestas', async () => {
  const capabilities=await request(app).get('/api/recommendations/capabilities').expect(200);
  assert.equal(capabilities.body.traditional,true);assert.equal(capabilities.body.semantic,false);
  const isolated=createApp({...config,recommenderUrl:'http://127.0.0.1:1'});
  const r=await request(isolated).post('/api/recommendations').set(bearer(adminToken)).send({mode:'traditional',limit:20}).expect(200);
  assert.equal(r.body.meta.mode,'deterministic');assert.equal(r.body.meta.queryInterpreted,false);
  await request(isolated).post('/api/recommendations').set(bearer(adminToken)).send({mode:'semantic'}).expect(400);
});

test('Fotos: permisos, validación, proveedor, persistencia y concurrencia', async () => {
  const c = await Church.create({ ...fixture('Fotos aisladas'), metadata:{dataStatus:'published'}, representatives: [rep._id], createdBy: admin._id });
  const url = '/api/churches/' + c.id + '/media', png = Buffer.from('89504e470d0a1a0a00000000','hex');
  const send = (token, version=1, data=png) => request(app).post(url).set(bearer(token)).set('If-Match','"'+version+'"').set('Content-Type','image/png').send(data);
  await request(app).post(url).expect(401);
  await send(userToken).expect(403); await send(otherToken).expect(403);
  await request(app).post(url).set(bearer(repToken)).expect(428);
  await send(repToken).expect(503);
  config.cloudinary = { cloudName: 'test-cloud', apiKey: 'test-key', apiSecret: 'secret-only-on-server' };
  let uploads=0, cleanup=0;
  app.locals.mediaFetch = async (url, options) => {
    if(url.endsWith('/destroy')){cleanup++;return {ok:true,json:async()=>({result:'ok'})};}
    uploads++; const id=options.body.get('public_id');
    assert.ok(id.startsWith('koinonia/'+c.id+'/'));
    return {ok:true,json:async()=>({public_id:id,secure_url:'https://res.cloudinary.com/test-cloud/image/upload/'+id+'.webp'})};
  };
  try {
    await send(repToken,1,Buffer.from('not an image')).expect(400);
    await send(repToken,1,Buffer.alloc(5*1024*1024+1)).expect(413);
    assert.equal(uploads,0);
    await request(app).post(url+'?category=invalid').set(bearer(repToken)).set('If-Match','"1"').set('Content-Type','image/png').send(png).expect(400);
    const r=await send(repToken).query({category:'meetings'}).expect(201);assert.equal(r.body.data.media[0].category,'meetings');assert.equal(r.body.data.media.length,1);assert.equal(r.body.data.metadata.version,2);assert.equal(r.body.data.metadata.dataStatus,'published');
    assert.ok(!JSON.stringify(r.body).includes('secret-only-on-server'));
    await send(repToken,1).expect(409);assert.equal(uploads,1);
    app.locals.mediaFetch=async()=>{throw Error('provider down');};await send(repToken,2).expect(502);
    assert.equal((await Church.findById(c.id)).media.length,1);
    app.locals.mediaFetch=async(url,options)=>{if(url.endsWith('/destroy')){cleanup++;return {ok:true};}await Church.updateOne({_id:c.id},{$inc:{'metadata.version':1}});const id=options.body.get('public_id');return {ok:true,json:async()=>({public_id:id,secure_url:'https://res.cloudinary.com/test-cloud/image/upload/'+id+'.webp'})};};
    await send(repToken,2).expect(409);assert.equal(cleanup,1);assert.equal((await Church.findById(c.id)).media.length,1);
    await Church.updateOne({_id:c.id},{$set:{media:Array.from({length:5},()=>({type:'image',url:'https://example.org/photo.jpg',source:'test'}))}});
    await send(repToken,3).expect(400);
  } finally {delete config.cloudinary;delete app.locals.mediaFetch;await Church.deleteOne({_id:c.id});}
});

test('Multimedia: orden, encuadre, eliminación autorizada y limpieza limitada a comunidad', async () => {
  const imageUrl='https://res.cloudinary.com/test-cloud/image/upload/v1/koinonia/';
  const c=await Church.create({...fixture('Edición de fotos'),metadata:{dataStatus:'published'},representatives:[rep._id],createdBy:admin._id});
  const owned=imageUrl+c.id+'/12345678-1234-1234-1234-123456789abc.webp';
  const media=[{type:'image',url:owned,source:'test',focalX:20,focalY:70},{type:'image',url:'https://example.org/external.jpg',source:'test'}];
  await request(app).put('/api/churches/'+c.id).set(bearer(repToken)).send({...fixture('Edición de fotos'),media:[{...media[0],focalX:101}]}).expect(400);
  const saved=await request(app).put('/api/churches/'+c.id).set(bearer(repToken)).set('If-Match','"1"').send({...fixture('Edición de fotos'),media:[media[1],media[0]]}).expect(200);
  assert.equal(saved.body.data.media[1].focalY,70);assert.equal(saved.body.data.media[0].url,media[1].url);
  const remove=(token,index,version)=>request(app).delete('/api/churches/'+c.id+'/media/'+index).set(bearer(token)).set('If-Match','"'+version+'"');
  await remove(otherToken,0,2).expect(403);await remove(repToken,0,1).expect(409);await remove(repToken,99,2).expect(400);
  let deleted=[];config.cloudinary={cloudName:'test-cloud',apiKey:'key',apiSecret:'secret'};
  app.locals.mediaFetch=async(url,opts)=>{deleted.push(opts.body.get('public_id'));return{ok:true};};
  try{await remove(repToken,0,2).expect(200);assert.deepEqual(deleted,[]);await remove(repToken,0,3).expect(200);assert.deepEqual(deleted,['koinonia/'+c.id+'/12345678-1234-1234-1234-123456789abc']);assert.equal((await Church.findById(c.id)).media.length,0);assert.equal((await Church.findById(c.id)).metadata.dataStatus,'published');}
  finally{delete config.cloudinary;delete app.locals.mediaFetch;await Church.deleteOne({_id:c.id});}
});

test('Publication history controls representative permissions', async () => {
  const c = await Church.create({...fixture('Publication delegated'), representatives:[rep.id], createdBy:admin.id});
  const status = (token,value) => request(app).patch('/api/churches/'+c.id+'/status').set(bearer(token)).send({status:value});
  await status(repToken,'published').expect(403);
  await status(repToken,'draft').expect(403);
  const first = await status(adminToken,'published').expect(200);
  assert.ok(first.body.data.metadata.firstPublishedByAdminAt);
  await status(otherToken,'draft').expect(403);
  await status(repToken,'draft').expect(200);
  await request(app).get('/api/churches/'+c.id).expect(404);
  await status(repToken,'published').expect(200);
  await request(app).get('/api/churches/'+c.id).expect(200);
  await status(repToken,'verified').expect(403);
  await request(app).put('/api/churches/'+c.id).set(bearer(repToken)).send({...fixture('Attempt'),metadata:{firstPublishedByAdminAt:new Date()}}).expect(400);
});

test('Representative optional password and categorized media validation', async()=>{
 const base={name:'Optional password',email:'custom-password@example.test',position:'Pastor'};
 await request(app).post('/api/representatives').set(bearer(adminToken)).send({...base,password:'short'}).expect(400);
 const created=await request(app).post('/api/representatives').set(bearer(adminToken)).send({...base,password:'Custom12'}).expect(201);
 assert.equal(created.body.initialPassword,'Custom12');assert.equal(created.body.data.password,undefined);
 const stored=await User.findById(created.body.data._id).select('+password');assert.notEqual(stored.password,'Custom12');
 await request(app).post('/api/auth/login').send({email:base.email,password:'Custom12'}).expect(200);
 const generated=await request(app).post('/api/representatives').set(bearer(adminToken)).send({...base,email:'blank-password@example.test',password:''}).expect(201);assert.ok(generated.body.initialPassword.length>=12);
 const media=['facilities','meetings','activities','representatives','banner'].map(category=>({type:'image',url:'https://example.org/'+category+'.jpg',source:'test',category}));
 const c=await request(app).post('/api/churches').set(bearer(adminToken)).send({...fixture('Categories'),media}).expect(201);
 assert.deepEqual(c.body.data.media.map(m=>m.category),media.map(m=>m.category));
 await request(app).put('/api/churches/'+c.body.data._id).set(bearer(adminToken)).send({...fixture('Categories'),media:[{...media[0],category:'invalid'}]}).expect(400);
});
