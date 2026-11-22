const path = require('node:path');
require('../Backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../Backend/.env'), quiet: true });
require('node:dns').setServers(['1.1.1.1']);
const mongoose = require('../Backend/node_modules/mongoose');

const sourceName = 'koinonia_synthetic_test_v2';
const targetName = 'koinonia_synthetic_test_v2_local';

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI no configurada');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const client = mongoose.connection.client;
  const admin = client.db('admin').admin();
  const known = await admin.listDatabases({ nameOnly: true });
  if (!known.databases.some(db => db.name === sourceName)) throw new Error('No se encontró la base origen exacta');
  if (known.databases.some(db => db.name.toLowerCase() === targetName.toLowerCase())) throw new Error('El destino ya existe; no se sobrescribirá');

  const source = client.db(sourceName);
  const target = client.db(targetName);
  const collections = await source.listCollections({ type: 'collection' }).toArray();
  const expected = [];

  for (const info of collections) {
    const input = source.collection(info.name);
    const output = await target.createCollection(info.name, info.options || {});
    const sourceIndexes = await input.listIndexes().toArray();
    let batch = [];
    const cursor = input.find({}).batchSize(250);
    for await (const document of cursor) {
      batch.push(document);
      if (batch.length >= 250) {
        await output.insertMany(batch, { ordered: true });
        batch = [];
      }
    }
    if (batch.length) await output.insertMany(batch, { ordered: true });

    for (const index of sourceIndexes) {
      if (index.name === '_id_') continue;
      const { key, name, v, ns, ...options } = index;
      await output.createIndex(key, { name, ...options });
    }
    expected.push({ name: info.name, count: await input.countDocuments(), indexes: sourceIndexes.length });
  }

  const actual = [];
  for (const row of expected) {
    const collection = target.collection(row.name);
    actual.push({ name: row.name, count: await collection.countDocuments(), indexes: (await collection.listIndexes().toArray()).length });
  }
  const mismatch = expected.find((row, i) => row.count !== actual[i].count || row.indexes !== actual[i].indexes);
  if (mismatch) throw new Error('La verificación de conteos o índices no coincide');

  const envPath = path.resolve(__dirname, '../Backend/.env');
  const fs = require('node:fs');
  const envText = fs.readFileSync(envPath, 'utf8');
  const uriLine = envText.match(/^MONGO_URI=(.*)$/m);
  if (!uriLine) throw new Error('No se encontró MONGO_URI para apuntar el entorno local');
  const currentUri = uriLine[1].trim();
  const uriParts = currentUri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^?]*)?(\?.*)?$/);
  if (!uriParts) throw new Error('No se pudo actualizar MONGO_URI de forma segura');
  const localUri = `${uriParts[1]}/${targetName}${uriParts[2] || ''}`;
  fs.writeFileSync(envPath, envText.replace(/^MONGO_URI=.*$/m, `MONGO_URI=${localUri}`), 'utf8');

  console.log(JSON.stringify({ source: sourceName, target: targetName, collections: actual.length, documents: actual.reduce((sum, row) => sum + row.count, 0), indexesVerified: actual.reduce((sum, row) => sum + row.indexes, 0), localEnvUpdated: true }));
}

main().catch(error => {
  console.error(JSON.stringify({ copyCompleted: false, error: error.name, message: error.message }));
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect().catch(() => {});
});
