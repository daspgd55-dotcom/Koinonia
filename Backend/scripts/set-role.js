const User = require('../src/models/user.model');
const { loadConfig } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !['user', 'representative', 'admin'].includes(role)) throw new Error('Uso: npm run user:role -- correo user|representative|admin');
  await connectDB(loadConfig().mongoUri);
  const user = await User.findOne({ email: email.trim().toLowerCase(), active: true });
  if (!user) throw new Error('Registra primero la cuenta mediante /api/auth/register');
  user.role = role; await user.save();
  console.log('Rol actualizado: ' + user.email + ' -> ' + user.role);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(disconnectDB);
