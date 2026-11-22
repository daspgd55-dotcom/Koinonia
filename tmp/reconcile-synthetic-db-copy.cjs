const path = require('node:path');
require('../Backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../Backend/.env'), quiet: true });
require('node:dns').setServers(['1.1.1.1']);
const mongoose = require('../Backend/node_modules/mongoose');
const sourceName = 'koinonia_synthetic_test_v2';
const targetName = 'koinonia_synthetic_test_v2_local';

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const client = mongoose.connection.client;
  const source = client.db(sourceName), target = client.db(targetName);
  const sourceCollections = await source.listCollections({ type: 'collection' }).toArray();
  const targetNames = new Set((await target.listCollections({ type: 'collection' }).toArray()).map(x => x.name));
  let inserted = 0;
  for (const info of sourceCollections) {
    if (!targetNames.has(info.name)) throw new Error('Falta una colección en el destino: ' + info.name);
    const input = source.collection(info.name), output = target.collection(info.name);
    let operations = [];
    for await (const doc of input.find({}).batchSize(250)) {
      operations.push({ updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: doc }, upsert: true } });
      if (operations.length >= 250) {
        const result = await output.bulkWrite(operations, { ordered: true });
        inserted += result.upsertedCount;
        operations = [];
      }
    }
    if (operations.length) {
      const result = await output.bulkWrite(operations, { ordered: true });
      inserted += result.upsertedCount;
    }
  }
  const issues = [];
  let docs = 0, indexes = 0;
  for (const info of sourceCollections) {
    const a = source.collection(info.name), b = target.collection(info.name);
    const [ac, bc, ai, bi] = await Promise.all([a.countDocuments(), b.countDocuments(), a.listIndexes().toArray(), b.listIndexes().toArray()]);
    docs += bc; indexes += bi.length;
    if (ac !== bc || ai.length !== bi.length) issues.push({ name: info.name, sourceCount: ac, targetCount: bc, sourceIndexes: ai.length, targetIndexes: bi.length });
  }
  if (issues.length) throw new Error('Verificación pendiente: ' + JSON.stringify(issues));
  console.log(JSON.stringify({ reconciled: true, insertedMissingDocuments: inserted, collections: sourceCollections.length, documents: docs, indexes: indexes }));
}

main().catch(error => {
  console.error(JSON.stringify({ reconciled: false, error: error.name, message: error.message }));
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect().catch(() => {}); });
