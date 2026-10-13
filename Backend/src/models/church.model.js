const { Schema, model } = require('mongoose');
const embedded = fields => new Schema(fields, { _id: false, strict: 'throw' });
const Point = embedded({ type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: { type: [Number], required: true, validate: v => v.length === 2 && v.every(Number.isFinite) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 } });
const Leader = embedded({ name: String, role: String });
// Modelo de Iglesia
const ChurchSchema = new Schema({
  identification: { name: { type: String, required: true, trim: true }, abbreviation: String, description: String, yearFounded: Number, distinctiveFeatures: String },
  verification: { representativeName: String, representativeRole: String, authorized: { type: Boolean, default: false }, source: String, lastUpdated: Date },
  location: { address: String, commune: { type: String, required: true }, city: String, region: String, postalCode: String, countryCode: String, coordinates: { type: Point, required: true }, parkingAvailability: { type: String, enum: ['yes', 'no', 'nearby', 'unknown'] }, accessibilityLevel: { type: String, enum: ['yes', 'no', 'partial', 'unknown'] }, parking: Boolean, accessibility: Boolean, accessNotes: String },
  christianIdentity: { branch: String, denomination: String, associatedTradition: String, network: String, languages: [String] },
  doctrine: { officialStatement: String, characteristics: [String], soteriology: String, eschatology: String },
  privateFields: { soteriology: Boolean, eschatology: Boolean, email: Boolean, phone: Boolean },
  meetingTypes: [String],
  meetings: [embedded({ type: String, audience: String, modality: String, addressOrUrl: String, frequencyNotes: String,
    schedule: [embedded({ day: String, startTime: String, durationMinutes: Number })] })],
  community: { targetGroups: [String], ministries: [String], activities: [String], description: String, memberRange: String },
  leadership: { mainLeader: Leader, otherLeaders: [Leader] },
  contact: { website: String, instagram: String, facebook: String, youtube: String, email: String, phone: String },
  firstVisit: { welcomeSupport: { type: String, enum: ['yes', 'no', 'partial', 'unknown'] }, instructions: String, newVisitorSupport: Boolean, welcomeProcess: String },
  media: [embedded({ type: { type: String, enum: ['image', 'video'] }, category: { type: String, enum: ['facilities','meetings','activities','representatives','banner'] }, url: String, title: String, source: String, focalX: {type:Number,min:0,max:100}, focalY: {type:Number,min:0,max:100} })],
  externalProfile: { type: require('./external-profile.schema'), default: undefined },
  importInfo: { schemaVersion: String, batchId: String, sourceFile: String, sourceRow: Number, importedAt: Date, issues: [String] },
  metadata: { firstPublishedByAdminAt: Date, dataStatus: { type: String, enum: ['draft', 'published', 'verified'], default: 'draft' }, version: { type: Number, default: 1 }, testData: { type: Boolean, default: false } },
  representatives: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  mergedInto: { type: Schema.Types.ObjectId, ref: 'Church' },
  reviewImport: { batchId: String, activityStatus: { type: String, enum: ['unverified'] }, externalKeys: [String], decision: String, reason: String },
  active: { type: Boolean, default: true }
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true });
//Coordenadas para geolocalizacion
ChurchSchema.index({ 'location.coordinates': '2dsphere' });
ChurchSchema.index({ active: 1, 'metadata.dataStatus': 1, 'location.commune': 1 });
ChurchSchema.index({ 'christianIdentity.denomination': 1 });
ChurchSchema.index({ 'externalProfile.provider': 1, 'externalProfile.placeId': 1 }, {
  unique: true, partialFilterExpression: { 'externalProfile.provider': { $type: 'string' }, 'externalProfile.placeId': { $type: 'string' } }
});
module.exports = model('Church', ChurchSchema);
