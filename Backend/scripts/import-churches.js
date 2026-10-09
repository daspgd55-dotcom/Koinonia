const { parseArgs } = require('node:util');
const { readDataset, importRecords } = require('../src/services/import.service');
const { connectDB, disconnectDB } = require('../src/config/db');
async function main() {
  const { values } = parseArgs({ options: { file: { type: 'string' }, admin: { type: 'string' }, apply: { type: 'boolean', default: false },
    'demo-publish': { type: 'boolean', default: false } }, strict: true });
  if (!values.file) throw new Error('Uso: npm run import:churches -- --file dataset.ndjson [--apply --admin correo] [--demo-publish]');
  const records = await readDataset(values.file);
  if (!values.apply) {
    console.log(JSON.stringify({ mode: 'validation_only', valid: records.length, writes: 0, databaseConnected: false }, null, 2)); return;
  }
  if (!values.admin) throw new Error('--apply requiere --admin con un correo existente');
  const { loadConfig } = require('../src/config/env');
  await connectDB(loadConfig().mongoUri);
  console.log(JSON.stringify(await importRecords(records, { email: values.admin, demoPublish: values['demo-publish'] }), null, 2));
}
main().catch(error => {
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details.slice(0, 20), null, 2));
  if (error.importProgress) console.error(JSON.stringify({ progress: error.importProgress, retry: 'Reejecutar es seguro: se omiten los registros existentes.' }));
  process.exitCode = 1;
}).finally(disconnectDB);
