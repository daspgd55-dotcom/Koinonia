const { Schema, model } = require('mongoose');
const Church = require('./church.model');
const { types, statuses } = require('../validation/linked-community');
const embedded = fields => new Schema(fields, { _id: false, strict: 'throw' });
const schema = new Schema({
  churchId: { type: Schema.Types.ObjectId, ref: 'Church', required: true, immutable: true },
  displayOrder:{type:Number,min:0,max:9999,default:1000},
  name: { type: String, required: true, trim: true, maxlength: 200 }, type: { type: String, enum: types, required: true },
  description: { type: String, default: '', maxlength: 10000 }, audience: [String],
  leaders: [embedded({ name: { type: String, required: true }, role: { type: String, required: true } })],
  contact: { website: String, instagram: String, facebook: String, youtube: String, email: String, phone: String, whatsapp: String, officeHours: String },
  privateFields: { email: { type: Boolean, default: false }, phone: { type: Boolean, default: false } },
  schedules:{mode:{type:String,enum:['none','church','custom'],default:'none'},meetingIds:{type:[String],default:undefined},meetings:[Church.schema.path('meetings').schema]},
  location: { mode: { type: String, enum: ['none', 'church', 'custom'], default: 'none' }, custom: embedded({ address: String, commune: { type: String, required: true }, city: String, region: String, postalCode: String, countryCode: String, coordinates: { type: Church.schema.path('location.coordinates').schema, default: undefined } }) },
  media: [embedded({ section:{type:String,enum:['logo','banner','facilities','meetings','activities','representatives','recommendation','gallery']}, category:{type:String,enum:['facilities','logo']}, type: { type: String, enum: ['image', 'video'], required: true }, url: { type: String, required: true }, source: { type: String, required: true }, title: String, frame: { type: String, enum: ['landscape', 'wide', 'square', 'circle', 'portrait', 'classic', 'cinema', 'banner', 'poster', 'story'] }, focalX: { type: Number, min: 0, max: 100 }, focalY: { type: Number, min: 0, max: 100 } })],
  status: { type: String, enum: statuses, default: 'draft' }, version: { type: Number, default: 1 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true });
schema.index({ churchId: 1, status: 1, name: 1 });
schema.index({ status: 1, type: 1, name: 1 });
module.exports = model('LinkedCommunity', schema);
