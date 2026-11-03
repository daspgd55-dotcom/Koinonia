const mongoose = require('mongoose');
const models = [require('../models/church-outreach-mail.model'),require('../models/church-outreach-mail-batch.model'),require('../models/church-outreach-member.model'),require('../models/church-outreach-team-lock.model'),require('../models/church-outreach-access.model'),require('../models/church-outreach-invitation.model'),require('../models/church-outreach-event.model'),require('../models/church-outreach-contact.model'),require('../models/church-registration-identity.model'),require('../models/church-registration.model'),require('../models/church-registration-event.model'),require('../models/church-registration-access.model'),require('../models/friendship.model'),require('../models/message.model'),require('../models/event-view.model'),require('../models/church-follow.model'),require('../models/security-limit.model'), require('../models/user.model'), require('../models/church.model'), require('../models/interaction.model'), require('../models/source.model'), require('../models/linked-community.model'), require('../models/event.model'), require('../models/event-participation.model')];
async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await require('./retention-indexes').prepare();
  await Promise.all(models.map(model => model.init()));
}
module.exports = { connectDB, disconnectDB: () => mongoose.disconnect() };
