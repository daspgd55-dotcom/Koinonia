require('../Backend/node_modules/dotenv').config({ path: require('node:path').resolve(__dirname, '../Backend/.env'), quiet: true });
require('node:dns').setServers(['1.1.1.1']);
const mongoose = require('../Backend/node_modules/mongoose');
const { EJSON } = require('../Backend/node_modules/bson');

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const client = mongoose.connection.client;
  const source = client.db('koinonia_synthetic_test_v2');
  const target = client.db('koinonia_synthetic_test_v2_local');
  const sourceCollections = await source.listCollections({ type: 'collection' }).toArray();
  const targetCollections = await target.listCollections({ type: 'collection' }).toArray();
  const mismatches = [];
  let documents = 0, indexes = 0;
  for (const info of sourceCollections) {
    const a = source.collection(info.name), b = target.collection(info.name);
    const [ac, bc, ai, bi] = await Promise.all([a.countDocuments(), b.countDocuments(), a.listIndexes().toArray(), b.listIndexes().toArray()]);
    documents += bc; indexes += bi.length;
    const normalizeIndex = list => list.map(({ ns, v, ...spec }) => spec).sort((x, y) => x.name.localeCompare(y.name));
    let equal = ac === bc && EJSON.stringify(normalizeIndex(ai), { relaxed: false }) === EJSON.stringify(normalizeIndex(bi), { relaxed: false });
    if (equal) {
      const [sourceDocs, targetDocs] = await Promise.all([a.find({}).toArray(), b.find({}).toArray()]);
      const targetById = new Map(targetDocs.map(doc => [EJSON.stringify(doc._id, { relaxed: false }), doc]));
      for (const doc of sourceDocs) {
        const clone = targetById.get(EJSON.stringify(doc._id, { relaxed: false }));
        if (!clone || EJSON.stringify(doc, { relaxed: false }) !== EJSON.stringify(clone, { relaxed: false })) { equal = false; break; }
      }
    }
    if (!equal) mismatches.push(info.name);
  }
  const extra = targetCollections.filter(x => !sourceCollections.some(y => y.name === x.name)).map(x => x.name);
  console.log(JSON.stringify({ verified: !mismatches.length && !extra.length && sourceCollections.length === targetCollections.length, sourceCollections: sourceCollections.length, targetCollections: targetCollections.length, documents, indexes, mismatchedCollections: mismatches, extraCollections: extra }));
}

main().catch(error => { console.error(JSON.stringify({ verified: false, error: error.name })); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect().catch(() => {}); });
