const { Schema, model } = require('mongoose');
const { fields } = require('../validation/profile');
const modes = Object.fromEntries(fields.map(k => [k, { type: String, enum: ['preferred', 'required', 'disabled'] }]));
const states = Object.fromEntries([...fields, 'location', 'locationSource', 'address', 'spiritualIdentity', 'goal', 'firstVisitPreference'].map(k => [k, { type: String, enum: ['answered', 'no_preference', 'unknown', 'omitted'] }]));

// Modelo de usuario
const UserSchema = new Schema({
  mailOutbox: {type:[new Schema({id:String,payload:String,expiresAt:Date,createdAt:Date},{_id:false})],select:false,default:undefined},
  avatar: { url: String, publicId: String },
  avatarVersion: { type: Number, default: 0 },
  name: { type: String, trim: true, maxlength: 100 },
  username: { type: String, trim: true, lowercase: true, minlength: 3, maxlength: 24, match: /^[a-z][a-z0-9_]{2,23}$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  emailVerifiedAt: {type:Date,default:null},
  emailVerificationRequired: {type:Boolean,default:false},
  invitationPending: {type:Boolean,default:false},
  invitationRevokedAt: {type:Date,select:false},
  invitationAudit: {type:[{actor:Schema.Types.ObjectId,at:Date,action:String}],select:false},
  invitedBy: {type:Schema.Types.ObjectId,ref:'User',select:false},
  emailAction: {hash:{type:String,select:false},purpose:{type:String,enum:['verify','invite'],select:false},expiresAt:{type:Date,select:false},requestedAt:{type:Date,select:false},issuedBy:{type:Schema.Types.ObjectId,ref:'User',select:false}},
  sessionVersion: { type: Number, default: 0, select: false },
  passwordReset: { hash: { type: String, select: false }, expiresAt: { type: Date, select: false }, requestedAt: { type: Date, select: false } },
  role: { type: String, enum: ['user', 'representative', 'admin'], default: 'user' },
  membershipChurch: { type: Schema.Types.ObjectId, ref: "Church", default: null },
  position: { type: String, trim: true, maxlength: 200 },
  active: { type: Boolean, default: true },
  preferences: {
    commune: String, denominations: [String], branches: [String], doctrinalTags: [String],
    activities: [String], ministries: [String], targetGroups: [String], languages: [String], meetingDay: String, meetingDays: [String],
    radiusKm: Number, location: { lat: Number, lng: Number }
  },
  searchContext: { locationSource: {type:String,enum:['device','address','none']}, addressPoint: {lat:Number,lng:Number,label:String,address:String,commune:String,verifiedAt:Date}, spiritualIdentity: { type: String, enum: ['christian','believer','no_religion','other_religion','nonbeliever','other'] }, address: { type: String, trim: true, maxlength: 200 }, goal: { type: String, enum: ['join', 'explore', 'change', 'connect'] },
    firstVisitPreference: { type: String, enum: ['information', 'welcome', 'contact', 'not_planned'] } },
  criterionModes: modes,
  answerStates: states,
  onboarding: { status: { type: String, enum: ['pending', 'completed', 'skipped'], default: 'pending' },
    version: { type: Number, default: 1 }, lastStep: { type: Number, default: 0 }, updatedAt: Date, completedAt: Date },
  profileRevision: { type: Number, default: 0 }
}, { timestamps: true, strict: 'throw' });
UserSchema.index({username:1},{unique:true,partialFilterExpression:{username:{$type:'string'}}});
module.exports = model('User', UserSchema);
