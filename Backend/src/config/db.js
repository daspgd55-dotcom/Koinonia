const mongoose = require('mongoose');
const models = [require('../models/security-limit.model'), require('../models/user.model'), require('../models/church.model'), require('../models/interaction.model'), require('../models/source.model'), require('../models/linked-community.model'), require('../models/event.model'), require('../models/event-participation.model')];
async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await require('./retention-indexes').prepare();
  await Promise.all(models.map(model => model.init()));
}
module.exports = { connectDB, disconnectDB: () => mongoose.disconnect() };
