const { musicalStyles, culturalStyles } = require('../validation/community-styles');
const { Schema, model } = require('mongoose');
const embedded = fields => new Schema(fields, { _id: false, strict: 'throw' });
const Point = embedded({ type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: { type: [Number], required: true, validate: v => v.length === 2 && v.every(Number.isFinite) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 } });
const Leader = embedded({ id: String, name: String, role: String });
// Modelo de Iglesia
const ChurchSchema = new Schema({
  registrationSources: {type:[embedded({request:{type:Schema.Types.ObjectId,ref:'ChurchRegistrationRequest'},at:Date,fields:[String],actor:{type:Schema.Types.ObjectId,ref:'User'}})],select:false,default:undefined},
  identification: { name: { type: String, required: true, trim: true }, abbreviation: String, description: String, yearFounded: Number, distinctiveFeatures: String },
  verification: { representativeName: String, representativeRole: String, authorized: { type: Boolean, default: false }, source: String, lastUpdated: Date },
  location: { address: String, commune: { type: String, required: true }, city: String, region: String, postalCode: String, countryCode: String, coordinates: { type: Point, required: true }, parkingAvailability: { type: String, enum: ['yes', 'no', 'nearby', 'unknown'] }, accessibilityLevel: { type: String, enum: ['yes', 'no', 'partial', 'unknown'] }, parking: Boolean, accessibility: Boolean, accessibilityDetails: { ramp: {type:String,enum:['yes','no','partial','unknown']}, accessibleRestroom: {type:String,enum:['yes','no','partial','unknown']}, elevator: {type:String,enum:['yes','no','partial','unknown']}, signLanguage: {type:String,enum:['yes','no','partial','unknown']}, airConditioning: {type:String,enum:['yes','no','partial','unknown']}, kitchen: {type:String,enum:['yes','no','partial','unknown']}, additionalSupport: String }, accessNotes: String },
  christianIdentity: { branch: String, denomination: String, associatedTradition: String, network: String, languages: [String] },
  doctrine: { officialStatement: String, characteristics: [String], soteriology: String, eschatology: String },
  privateFields: { musicalStyles: Boolean, culturalStyle: Boolean, accessibilityLevel: Boolean, accessibilityDetails: Boolean, soteriology: Boolean, eschatology: Boolean, email: Boolean, phone: Boolean },
  sectionOrder: {type:[String],default:undefined,enum:['intro','visit','meetings','doctrine','life','contact']},
  meetingTypes: [String],
  meetings: [embedded({ id:String, type: String, audience: String, modality: String, addressOrUrl: String, frequencyNotes: String, frequency: {type:String,enum:["weekly","fortnightly","monthly","occasional"]}, visitsEnabled: Boolean,
    schedule: [embedded({ day: String, startTime: String, durationMinutes: Number })] })],
  community: { musicalStyles: [{ type: String, enum: musicalStyles }], culturalStyle: { type: String, enum: culturalStyles }, targetGroups: [String], ministries: [String], activities: [String], description: String, memberRange: String },
  leadership: { mainLeader: Leader, otherLeaders: [Leader] },
  contact: { website: String, instagram: String, facebook: String, youtube: String, email: String, phone: String, whatsapp: String, officeHours: String },
  visitSettings:{accessMode:{type:String,enum:['all','selected'],default:'all'},representativeIds:[{type:Schema.Types.ObjectId,ref:'User'}],welcomeEmailEnabled:{type:Boolean,default:true},emailEnabled:{type:Boolean,default:false},emailRecipients:[String]},
  firstVisit: { requestsEnabled: {type:Boolean,default:false}, welcomeSupport: { type: String, enum: ['yes', 'no', 'partial', 'unknown'] }, instructions: String, newVisitorSupport: Boolean, welcomeProcess: String },
  media: [embedded({ section:{type:String,enum:['logo','banner','facilities','meetings','activities','representatives','recommendation','gallery']}, leaderId: String, frame: {type:String,enum:['landscape','wide','square','circle','portrait','classic','cinema','banner','poster','story']}, type: { type: String, enum: ['image', 'video'] }, category: { type: String, enum: ['facilities','meetings','activities','representatives','banner','logo'] }, url: String, title: String, source: String, focalX: {type:Number,min:0,max:100}, focalY: {type:Number,min:0,max:100} })],
  externalProfile: { type: require('./external-profile.schema'), default: undefined },
  importInfo: { schemaVersion: String, batchId: String, sourceFile: String, sourceRow: Number, importedAt: Date, issues: [String] },
  metadata: { firstPublishedByAdminAt: Date, dataStatus: { type: String, enum: ['draft', 'published', 'verified'], default: 'draft' }, version: { type: Number, default: 1 }, testData: { type: Boolean, default: false } },
  publicationRequest: { verificationRequested:Boolean, status: {type:String,enum:['pending','resolved']}, requestedBy: {type:Schema.Types.ObjectId,ref:'User'}, requestedAt:Date },
  representativeRoles:[embedded({user:{type:Schema.Types.ObjectId,ref:'User',required:true},subrole:{type:String,enum:['administrator','moderator','editor','welcome'],required:true}})],
  teamAudit:[embedded({actor:{type:Schema.Types.ObjectId,ref:'User'},at:Date,user:{type:Schema.Types.ObjectId,ref:'User'},subrole:String,action:String})],
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
