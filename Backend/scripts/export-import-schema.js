const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { importRecord } = require('../src/validation/import.schema');
const target = path.resolve(__dirname, '../docs/church-import.schema.json');
fs.writeFileSync(target, JSON.stringify(z.toJSONSchema(importRecord, { target: 'draft-2020-12' }), null, 2) + '\n');
console.log('Contrato exportado: docs/church-import.schema.json');
