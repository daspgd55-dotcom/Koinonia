const User = require('../src/models/user.model'), Church = require('../src/models/church.model');
const { loadConfig } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');

async function main() {
  // 1. Extraemos los argumentos limpios de la terminal
  const emailInput = process.argv[2];
  const confirm = process.argv[3];
  const config = loadConfig();

  const dbName = new URL(config.mongoUri).pathname.replace(/^\//, '');
  if (confirm !== '--confirm-demo' || !dbName.endsWith('_demo') || process.env.NODE_ENV === 'production')
    throw new Error('Solo bases terminadas en _demo; uso: npm run seed -- correo-admin --confirm-demo');

  await connectDB(config.mongoUri);

  const emailBuscar = String(emailInput).toLowerCase().trim();
  
  const admin = await User.findOne({ email: emailBuscar, role: 'admin', active: true });
  if (!admin) throw new Error('Se requiere un administrador activo existente. Registra la cuenta y asígnale el rol antes de ejecutar seed.');

  const samples = [
    ['000000000000000000000101', 'Comunidad DEMO Centro', [-70.65, -33.45], 'Santiago'],
    ['000000000000000000000102', 'Comunidad DEMO Oriente', [-70.63, -33.45], 'Providencia'],
    ['000000000000000000000103', 'Comunidad DEMO Sur', [-70.60, -33.60], 'La Pintana']
  ];
  for (const [id, name, coordinates, commune] of samples) {
    await Church.updateOne({ _id: id }, { $setOnInsert: {
      identification: { name, description: 'Datos ficticios para desarrollo; no representan una iglesia real.' },
      verification: { authorized: true, source: 'synthetic-demo', lastUpdated: new Date() },
      location: { address: 'Dirección ficticia DEMO', commune, city: 'Santiago', region: 'Metropolitana', coordinates: { type: 'Point', coordinates } },
      christianIdentity: { branch: 'Protestante', denomination: 'Bautista', languages: ['Español'] },
      doctrine: { officialStatement: 'Declaración ficticia para pruebas', characteristics: ['Formación bíblica'] },
      meetings: [{ type: 'Reunión DEMO', modality: 'Presencial', schedule: [{ day: 'Domingo', startTime: '10:00', durationMinutes: 90 }] }],
      community: { activities: ['Jóvenes', 'Ayuda social'] }, leadership: { mainLeader: { name: 'Responsable ficticio', role: 'Representante' } },
      metadata: { dataStatus: 'published', version: 1 }, representatives: [admin._id], createdBy: admin._id, updatedBy: admin._id, active: true
    } }, { upsert: true, runValidators: true });
  }
  console.log('Tres comunidades ficticias disponibles. No se sobrescribieron registros existentes.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(disconnectDB);
