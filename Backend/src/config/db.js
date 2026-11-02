const mongoose = require('mongoose');
const models = [require('../models/church-registration-identity.model'),require('../models/church-registration.model'),require('../models/church-registration-event.model'),require('../models/church-registration-access.model'),require('../models/friendship.model'),require('../models/message.model'),require('../models/event-view.model'),require('../models/church-follow.model'),require('../models/security-limit.model'), require('../models/user.model'), require('../models/church.model'), require('../models/interaction.model'), require('../models/source.model'), require('../models/linked-community.model'), require('../models/event.model'), require('../models/event-participation.model')];
async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await require('./retention-indexes').prepare();
  await Promise.all(models.map(model => model.init()));
}
module.exports = { connectDB, disconnectDB: () => mongoose.disconnect() };
