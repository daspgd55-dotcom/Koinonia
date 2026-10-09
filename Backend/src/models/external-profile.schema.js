const { Schema } = require('mongoose');
const embedded = fields => new Schema(fields, { _id: false, strict: 'throw' });
// Esquema para información de perfil externo (Google Maps, etc.)
const externalProfile = embedded({
  provider: { type: String, enum: ['google_maps'], required: true },
  placeId: { type: String, required: true },
  mapsUrl: { type: String, required: true },
  sourceTitle: String,
  subtitle: String,
  categories: [String],
  sourceAddress: String,
  sourceCity: String,
  aliasPlaceIds: [String],
  links: [embedded({ kind: String, url: String })],
  phones: [String],
  emails: [String],
  capturedAtBasis: String,
  capturedAt: { type: Date, required: true },
  openingHours: [embedded({
    day: { type: String, enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] },
    status: { type: String, enum: ['closed', 'open24h', 'intervals', 'unparsed'] },
    raw: String,
    intervals: [embedded({ startTime: String, endTime: String, endDayOffset: { type: Number, enum: [0, 1] } })]
  })]
});
module.exports = externalProfile;
