// Crea exclusivamente datos ficticios nuevos; nunca reemplaza cuentas existentes.
const crypto = require('node:crypto'), bcrypt = require('bcryptjs');
const { loadConfig } = require('../src/config/env'), { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model'), Church = require('../src/models/church.model');
async function main() {
  if (!process.argv.includes('--create')) throw Error('Usa --create para crear la cuenta y comunidad ficticias en la base configurada.');
  await connectDB(loadConfig().mongoUri);
  const email = 'representante.prueba.20261006@koinonia.example';
  if (await User.exists({ email })) throw Error('La cuenta de prueba ya existe. No se modificó ni se restableció su contraseña.');
  const password = crypto.randomBytes(18).toString('base64url');
  const user = await User.create({ name: 'Daniel Ejemplo', email, position: 'Representante institucional de prueba', role: 'representative', password: await bcrypt.hash(password, 12), onboarding: { status: 'skipped', version: 3, lastStep: 0 } });
  const church = await Church.create({
    identification: { name: 'Comunidad Camino de Prueba (FICTICIA)', abbreviation: 'CCP', yearFounded: 2020, description: 'Comunidad completamente ficticia para probar Koinonía. No corresponde a una iglesia real.', distinctiveFeatures: 'Datos sintéticos para pruebas de permisos, edición y consulta.' },
    verification: { representativeName: 'Daniel Ejemplo', representativeRole: 'Representante de prueba', authorized: true, source: 'Datos ficticios de prueba solicitados por el propietario del proyecto', lastUpdated: new Date() },
    location: { address: 'Dirección ficticia 123; no visitar', commune: 'Santiago', city: 'Santiago', region: 'Región Metropolitana', countryCode: 'CL', coordinates: { type: 'Point', coordinates: [-70.65, -33.45] }, parkingAvailability: 'nearby', accessibilityLevel: 'partial', accessNotes: 'Punto cartográfico ilustrativo. No identifica una sede real.' },
    christianIdentity: { branch: 'Protestante', denomination: 'Bautista', associatedTradition: 'Ejemplo académico', network: 'Red ficticia de prueba', languages: ['Español'] },
    doctrine: { officialStatement: 'Declaración ficticia: comunidad cristiana orientada a la enseñanza bíblica, la oración y el servicio.', characteristics: ['Autoridad de las Escrituras', 'Formación bíblica'], soteriology: 'No se afirma en ninguna de las anteriores', eschatology: 'Sin postura definida' },
    meetings: [{ type: 'Culto principal', audience: 'Todos', modality: 'Presencial', addressOrUrl: 'Dirección ficticia; no visitar', frequencyNotes: 'Horario ilustrativo, sin reuniones reales.', schedule: [{ day: 'Domingo', startTime: '11:00', durationMinutes: 90 }] }],
    community: { memberRange: '50-100', targetGroups: ['Jóvenes', 'Adultos'], ministries: ['Jóvenes', 'Oración'], activities: ['Voluntariado', 'Eventos familiares'], description: 'Actividades ficticias para ejercitar los formularios.' },
    leadership: { mainLeader: { name: 'Samuel Ejemplo (ficticio)', role: 'Coordinador' }, otherLeaders: [{ name: 'Ana Ejemplo (ficticia)', role: 'Encargada de jóvenes' }] },
    contact: { email: 'contacto@comunidad-ficticia.example', website: 'https://comunidad-ficticia.example' },
    firstVisit: { instructions: 'No visitar: ficha creada exclusivamente para pruebas.', welcomeSupport: 'partial', welcomeProcess: 'Proceso ilustrativo de acogida.' },
    metadata: { testData: true, dataStatus: 'draft' }, representatives: [user._id], createdBy: user._id, updatedBy: user._id
  });
  console.log(JSON.stringify({ email, password, role: user.role, userId: user.id, churchId: church.id, churchName: church.identification.name, status: church.metadata.dataStatus }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(disconnectDB);
