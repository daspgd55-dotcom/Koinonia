const { Schema, model } = require('mongoose');
// Modelo de interacción usuario-iglesia
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  church: { type: Schema.Types.ObjectId, ref: 'Church', required: true },
  type: { type: String, enum: ['saved', 'discarded'], required: true },
  reason: { type: String, maxlength: 500 }
}, { timestamps: true, strict: 'throw' });
schema.index({ user: 1, church: 1 }, { unique: true });
module.exports = model('Interaction', schema);
