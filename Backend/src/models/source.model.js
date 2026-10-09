const { Schema, model } = require('mongoose');
const schema = new Schema({
  church: { type: Schema.Types.ObjectId, ref: 'Church', required: true, index: true },
  title: { type: String, required: true }, url: String, text: String,
  kind: { type: String, enum: ['website', 'document', 'institutional'], required: true },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, strict: 'throw' });
module.exports = model('ChurchSource', schema, 'church_sources');
