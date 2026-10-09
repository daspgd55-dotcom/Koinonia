const { loadConfig } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');

// Inicia el servidor, conectando a la base de datos
async function start() {
  const config = loadConfig(); await connectDB(config.mongoUri);
  const server = createApp(config).listen(config.port, () => console.log('Koinonía API: http://localhost:' + config.port));
  const shutdown = () => server.close(async () => { await disconnectDB(); process.exit(0); });
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
start().catch(error => { console.error('No se pudo iniciar: ' + error.message); process.exit(1); });
