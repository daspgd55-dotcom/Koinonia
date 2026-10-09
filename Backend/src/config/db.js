const mongoose = require('mongoose');
const models = [require('../models/user.model'), require('../models/church.model'), require('../models/interaction.model'), require('../models/source.model')];
async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all(models.map(model => model.init()));
}
module.exports = { connectDB, disconnectDB: () => mongoose.disconnect() };
