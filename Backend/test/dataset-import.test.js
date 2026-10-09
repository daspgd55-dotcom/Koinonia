const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDB, disconnectDB } = require('../src/config/db');
const { readDataset, importRecords } = require('../src/services/import.service');
const { validateRecord } = require('../src/validation/import.schema');
const Church = require('../src/models/church.model'), User = require('../src/models/user.model');
const { createApp } = require('../src/app');
const request = require('supertest');
const jwt = require('jsonwebtoken');
let mongo, records, admin, temp;
const email = 'import-admin@example.test';
const config = { jwtSecret: 'dataset-tests-only-long-secret-12345', corsOrigins: [], recommenderUrl: null };
const app = createApp(config);
before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'koinonia-import-'));
  records = await readDataset(path.resolve(__dirname, '../data/google-maps-2026-05-18/churches.import.ndjson'));
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12', downloadDir: path.resolve(__dirname, '../.cache/mongodb') } });
  await connectDB(mongo.getUri('koinonia_import_demo'));
  admin = await User.create({ email, password: 'unused-in-these-tests', role: 'admin' });
}, { timeout: 240000 });
after(async () => {
  await disconnectDB(); if (mongo) await mongo.stop();
  // Solo el directorio temporal creado por esta prueba.
  if (temp) await fs.rm(temp, { recursive: true, force: true });
});
test('Dataset completo: reconcilia filas y conserva identidad única y procedencia', async () => {
  const report = JSON.parse(await fs.readFile(path.resolve(__dirname, '../data/google-maps-2026-05-18/quality-report.json'), 'utf8'));
  assert.equal(Object.values(report.dispositions).reduce((a, b) => a + b, 0), report.inputRows);
  assert.equal(records.length, report.dispositions.accepted);
  assert.equal(new Set(records.map(r => r.externalKey)).size, records.length);
  for (const record of records) {
    assert.equal(record.church.verification.authorized, false);
    assert.equal(record.church.christianIdentity, undefined);
    assert.equal(record.church.meetings, undefined);
  }
});
test('Importación real, fechas BSON, geografía e idempotencia sin sobrescribir ediciones', async () => {
  const first = await importRecords(records, { email });
  assert.equal(first.inserted, records.length);
  const church = await Church.findOne({ 'externalProfile.placeId': records[0].church.externalProfile.placeId });
  assert.ok(church.externalProfile.capturedAt instanceof Date);
  assert.ok(church.importInfo.importedAt instanceof Date);
  assert.equal(church.metadata.dataStatus, 'draft');
  assert.equal(church.representatives.length, 0);
  const publicRows = await request(app).get('/api/churches').expect(200);
  assert.equal(publicRows.body.pagination.total, 0);
  church.identification.name = 'Edición humana que se conserva'; await church.save();
  const repeat = await importRecords(records, { email });
  assert.equal(repeat.inserted, 0); assert.equal(repeat.skippedExisting, records.length);
  assert.equal((await Church.findById(church.id)).identification.name, 'Edición humana que se conserva');
  const geo = await Church.find({ 'location.coordinates': { $near: { $geometry: records[0].church.location.coordinates, $maxDistance: 100 } } });
  assert.ok(geo.length > 0);
});
test('Identidad protegida: índice único y API no permite falsificar procedencia', async () => {
  const record = records[0];
  const duplicate = (await Church.findOne({ 'externalProfile.placeId': record.church.externalProfile.placeId })).toObject();
  delete duplicate._id;
  await assert.rejects(Church.create(duplicate), error => error.code === 11000);
  const token = jwt.sign({}, config.jwtSecret, { subject: admin.id, issuer: 'koinonia', audience: 'koinonia-api', expiresIn: '1h' });
  await request(app).post('/api/churches').set('Authorization', 'Bearer ' + token).send(record.church).expect(400);
});
test('Lote inválido o repetido se rechaza antes de insertar', async () => {
  const beforeCount = await Church.countDocuments();
  const file = path.join(temp, 'bad.ndjson');
  await fs.writeFile(file, JSON.stringify(records[0]) + '\n{"not":"a record"}\n');
  await assert.rejects(readDataset(file), /Lote rechazado/);
  await fs.writeFile(file, JSON.stringify(records[0]) + '\n' + JSON.stringify(records[0]));
  await assert.rejects(readDataset(file), /Lote rechazado/);
  const bad = structuredClone(records[0]); bad.church.location.coordinates.coordinates = [-70, 91];
  await assert.rejects(importRecords([records[0], bad], { email }));
  assert.equal(await Church.countDocuments(), beforeCount);
});
test('Semántica del contrato: ID de Maps, horas y fechas', () => {
  const mismatch = structuredClone(records[0]); mismatch.externalKey = 'google_maps:fakeid';
  assert.throws(() => validateRecord(mismatch), /externalKey/);
  const date = structuredClone(records[0]); date.church.externalProfile.capturedAt = 'ayer';
  assert.throws(() => validateRecord(date));
  const hours = structuredClone(records[0]);
  hours.church.externalProfile.openingHours = [{ day: 'Lunes', raw: 'Closed', status: 'closed', intervals: [{ startTime: '10:00', endTime: '11:00', endDayOffset: 0 }] }];
  assert.throws(() => validateRecord(hours), /Estado de apertura/);
});
test('Publicación demo explícita y protección de producción, sin inventar autorización', async () => {
  const demo = structuredClone(records[0]);
  demo.church.externalProfile.placeId = 'ChIJ_test_only_demo';
  demo.church.externalProfile.mapsUrl = 'https://www.google.com/maps/search/?query_place_id=ChIJ_test_only_demo';
  demo.externalKey = 'google_maps:ChIJ_test_only_demo';
  await assert.rejects(importRecords([demo], { email, demoPublish: true, nodeEnv: 'production' }), /fuera de producción/);
  await assert.rejects(importRecords([demo], { email: 'unknown@example.test' }), /administrador/);
  await importRecords([demo], { email, demoPublish: true, nodeEnv: 'test' });
  const response = await request(app).get('/api/churches').expect(200);
  assert.equal(response.body.pagination.total, 1);
  assert.equal(response.body.data[0].metadata.testData, true);
  assert.equal(response.body.data[0].importInfo, undefined);
  assert.equal(response.body.data[0].externalProfile.provider, 'google_maps');
  const document = await Church.findOne({ 'externalProfile.placeId': demo.church.externalProfile.placeId });
  assert.equal(document.verification.authorized, false);
});
