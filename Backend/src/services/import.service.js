const fs = require('node:fs/promises');
const { Types } = require('mongoose');
const Church = require('../models/church.model');
const User = require('../models/user.model');
const { validateRecord } = require('../validation/import.schema');

// Convierte un registro validado en un documento de Mongoose listo para guardar
function documentFor(record, actorId, { demoPublish = false, importedAt = new Date() } = {}) {
  return new Church({ ...record.church,
    verification: { ...record.church.verification, lastUpdated: new Date(record.church.externalProfile.capturedAt) },
    importInfo: { ...record.provenance, schemaVersion: record.schemaVersion, importedAt },
    metadata: { dataStatus: demoPublish ? 'published' : 'draft', version: 1, testData: demoPublish },
    representatives: [], createdBy: actorId, updatedBy: actorId, active: true });
}

// Lee un archivo de texto con un registro JSON por línea, valida cada registro y devuelve un arreglo de registros válidos
async function readDataset(file) {
  if ((await fs.stat(file)).size > 32 * 1024 * 1024) throw new Error('Máximo 32 MiB por lote');
  const lines = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '').split(/\r?\n/);
  const records = [], errors = [], keys = new Set(), actor = new Types.ObjectId();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      const record = validateRecord(JSON.parse(line));
      if (keys.has(record.externalKey)) throw new Error('externalKey repetido dentro del lote');
      keys.add(record.externalKey);
      await documentFor(record, actor).validate();
      records.push(record);
    } catch (error) {
      const detail = error.issues ? error.issues.map(issue => issue.path.join('.') + ': ' + issue.message).join('; ') : error.message;
      errors.push({ line: index + 1, error: detail });
    }
  }
  if (!records.length && !errors.length) throw new Error('Dataset vacío');
  if (errors.length) {
    const error = new Error('Lote rechazado: ' + errors.length + ' líneas inválidas. No se importó ninguna.');
    error.details = errors; throw error;
  }
  return records;
}

// Importa un lote de registros validados, verificando que exista un administrador activo y que no se dupliquen registros existentes
async function importRecords(records, { email, demoPublish = false, nodeEnv = process.env.NODE_ENV } = {}) {
  if (demoPublish && (!Church.db.name.endsWith('_demo') || nodeEnv === 'production'))
    throw new Error('--demo-publish solo está permitido en bases terminadas en _demo fuera de producción');
  const admin = await User.findOne({ email: String(email || '').trim().toLowerCase(), role: 'admin', active: true });
  if (!admin) throw new Error('Se requiere un administrador activo existente; este importador no crea cuentas');
  // Valida todo antes de escribir incluso cuando se llama desde otro módulo.
  const documents = [];
  for (const raw of records) {
    const doc = documentFor(validateRecord(raw), admin._id, { demoPublish });
    await doc.validate(); documents.push(doc);
  }
  const summary = { total: documents.length, inserted: 0, skippedExisting: 0, status: demoPublish ? 'published_test_data' : 'draft', database: Church.db.name };
  for (const doc of documents) {
    const identity = { 'externalProfile.provider': doc.externalProfile.provider, $or: [
      { 'externalProfile.placeId': doc.externalProfile.placeId }, { 'externalProfile.aliasPlaceIds': doc.externalProfile.placeId }
    ] };
    if (await Church.exists(identity)) { summary.skippedExisting++; continue; }
    try { await doc.save(); summary.inserted++; }
    catch (error) {
      if (error.code === 11000) summary.skippedExisting++;
      else { error.importProgress = summary; throw error; }
    }
  }
  return summary;
}

module.exports = { documentFor, readDataset, importRecords };
