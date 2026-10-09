const { connectDB, disconnectDB } = require('../src/config/db');
const { loadConfig } = require('../src/config/env');
const User = require('../src/models/user.model');

async function consultar() {
  const config = loadConfig();
  await connectDB(config.mongoUri);

  // 1. Contar cuántos usuarios existen en total
  const cantidad = await User.countDocuments({});
  console.log(`\n===================================`);
  console.log(`CANTIDAD TOTAL DE USUARIOS: ${cantidad}`);
  console.log(`===================================`);

  // 2. Traer todos los usuarios mostrando su id, email, rol y la contraseña guardada
  const usuarios = await User.find({}, 'email role password active');
  console.log('--- DETALLE DE USUARIOS ---');
  console.log(JSON.stringify(usuarios, null, 2));
  console.log(`===================================\n`);
}

consultar().then(disconnectDB);
