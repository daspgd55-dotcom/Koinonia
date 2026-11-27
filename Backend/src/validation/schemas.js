const { musicalStyles, culturalStyles } = require('./community-styles');
const { z } = require('zod');
const { HttpError } = require('../utils/errors');
const text = z.string().trim().min(1).max(200), longText = z.string().trim().min(1).max(10000);
const list = z.array(text).max(50);
const id = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Identificador inválido');
const days = z.enum(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
const url = z.string().url().max(2000).refine(v => /^https?:\/\//i.test(v), 'Solo URLs HTTP/HTTPS');
const lat = z.number().min(-90).max(90), lng = z.number().min(-180).max(180);
const coordinates = z.strictObject({ type: z.literal('Point'), coordinates: z.tuple([lng, lat]) });
const location = z.strictObject({ lat, lng });
const password = z.string().min(8).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Máximo 72 bytes UTF-8');
const username = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,23}$/, 'Usa 3 a 24 caracteres: empieza por una letra; solo letras, números y guion bajo').refine(v=>!['admin','administrator','administrador','root','soporte','support','koinonia','moderador'].includes(v),'Este nombre de usuario está reservado');
const register = z.strictObject({ email: z.string().trim().email().max(254).toLowerCase(), name: text.max(100).optional(), username: username.optional(), password });
const login = z.strictObject({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(200) });
const preferences = z.strictObject({
  commune: text.optional(), denominations: list.optional(), branches: list.optional(), doctrinalTags: list.optional(),
  activities: list.optional(), ministries: list.optional(), targetGroups: list.optional(), languages: list.optional(), meetingDay: days.optional(), meetingDays: z.array(days).max(7).optional(),
  radiusKm: z.number().positive().max(200).optional(), location: location.optional()
});
const leader = z.strictObject({ id: z.string().uuid().optional(), name: text, role: text });
const church = z.strictObject({
  identification: z.strictObject({ name: text, abbreviation: text.optional(), description: longText.optional(),
    yearFounded: z.number().int().min(1).max(new Date().getFullYear()).optional(), distinctiveFeatures: longText.optional() }),
  verification: z.strictObject({ representativeName: text.optional(), representativeRole: text.optional(), authorized: z.boolean().default(false), source: text.optional() }).optional(),
  location: z.strictObject({ address: text.optional(), commune: text, city: text.optional(), region: text.optional(), postalCode: z.string().regex(/^\d{7}$/).optional(), countryCode: z.literal('CL').optional(), coordinates,
    parkingAvailability: z.enum(['yes', 'no', 'nearby', 'unknown']).optional(), accessibilityLevel: z.enum(['yes', 'no', 'partial', 'unknown']).optional(),
    parking: z.boolean().optional(), accessibility: z.boolean().optional(), accessibilityDetails: z.strictObject({ramp: z.enum(['yes','no','partial','unknown']).optional(),accessibleRestroom: z.enum(['yes','no','partial','unknown']).optional(),elevator: z.enum(['yes','no','partial','unknown']).optional(),signLanguage: z.enum(['yes','no','partial','unknown']).optional(), airConditioning: z.enum(['yes','no','partial','unknown']).optional(), kitchen: z.enum(['yes','no','partial','unknown']).optional(),additionalSupport: longText.optional()}).optional(), accessNotes: longText.optional() }),
  christianIdentity: z.strictObject({ branch: text.optional(), denomination: text.optional(), associatedTradition: text.optional(), network: text.optional(), languages: list.optional() }).optional(),
  doctrine: z.strictObject({ officialStatement: longText.optional(), characteristics: list.optional(), soteriology: text.optional(), eschatology: text.optional() }).optional(),
  privateFields: z.strictObject({ musicalStyles: z.boolean().optional(), culturalStyle: z.boolean().optional(), accessibilityLevel: z.boolean().optional(), accessibilityDetails: z.boolean().optional(), soteriology: z.boolean().optional(), eschatology: z.boolean().optional(), email: z.boolean().optional(), phone: z.boolean().optional() }).optional(),
  sectionOrder:z.array(z.enum(['intro','visit','meetings','doctrine','life','contact'])).max(6).refine(a=>new Set(a).size===a.length,'No repitas apartados').optional(),
  meetingTypes: list.optional(),
  meetings: z.array(z.strictObject({ id:z.string().uuid().optional(), type: text, audience: text.optional(), modality: z.enum(['Presencial', 'Online', 'Híbrida']),
    addressOrUrl: text.optional(), frequencyNotes: longText.optional(), frequency: z.enum(["weekly","fortnightly","monthly","occasional"]).optional(), visitsEnabled: z.boolean().optional(), schedule: z.array(z.strictObject({ day: days, startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      durationMinutes: z.number().int().positive().max(1440).optional() })).min(1).max(14) })).max(50).optional(),
  community: z.strictObject({ musicalStyles: z.array(z.enum(musicalStyles)).max(5).refine(a=>new Set(a).size===a.length, "No repitas estilos musicales").optional(), culturalStyle: z.enum(culturalStyles).optional(), targetGroups: list.optional(), ministries: list.optional(), activities: list.optional(), description: longText.optional(), memberRange: text.optional() }).optional(),
  leadership: z.strictObject({ mainLeader: leader.optional(), otherLeaders: z.array(leader).max(50).optional() }).optional(),
  contact: z.strictObject({ website: url.optional(), instagram: url.optional(), facebook: url.optional(), youtube: url.optional(),
    email: z.string().email().optional(), phone: text.max(40).optional(), whatsapp: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Usa el número internacional sin espacios, por ejemplo +56912345678').optional(), officeHours: longText.optional() }).optional(),
  visitSettings:z.strictObject({accessMode:z.enum(['all','selected']).default('all'),representativeIds:z.array(id).max(50).default([]),welcomeEmailEnabled:z.boolean().default(true),emailEnabled:z.boolean().default(false),emailRecipients:z.array(z.string().trim().toLowerCase().email().max(254)).max(10).default([])}).optional(),
  firstVisit: z.strictObject({ requestsEnabled: z.boolean().optional(), welcomeSupport: z.enum(['yes', 'no', 'partial', 'unknown']).optional(), instructions: longText.optional(), newVisitorSupport: z.boolean().optional(), welcomeProcess: longText.optional() }).optional(),
  media: z.array(z.strictObject({ section:z.enum(['logo','banner','facilities','meetings','activities','representatives','recommendation']).optional(), leaderId: z.string().uuid().optional(), frame: z.enum(['landscape','wide','square','circle','portrait','classic','cinema','banner','poster','story']).optional(), type: z.enum(['image', 'video']), category: z.enum(['facilities','meetings','activities','representatives','banner','logo']).optional(), url, title: text.optional(), source: text, focalX: z.number().min(0).max(100).optional(), focalY: z.number().min(0).max(100).optional() })).max(30).refine(items=>items.filter(m=>m.type==='video').length<=1,'Solo se admite un video por ficha.').refine(items=>items.filter(m=>m.type==='image').length<=10,'La ficha admite un máximo de 10 fotos.').optional()
});
const queryNumber = (min, max, fallback) => z.preprocess(v => typeof v === 'string' && v.trim() !== '' ? Number(v) : v,
  z.number().min(min).max(max).optional().default(fallback));
const selectedTags = item => z.preprocess(v=>typeof v==="string"?[v]:v,z.array(item).min(1).max(30)).optional();
const search = z.strictObject({
  conceptMode:z.enum(["all","any"]).optional(), activities:selectedTags(text), ministries:selectedTags(text), supports:selectedTags(z.enum(['ramp','accessibleRestroom','elevator','signLanguage','airConditioning','kitchen'])), images:z.literal('yes').optional(),
  view: z.enum(['full','card']).default('full'),
  sort: z.enum(['name','distance']).optional(),
  q: text.optional(), commune: text.optional(), denomination: text.optional(), branch: text.optional(),
  doctrine: text.optional(), activity: text.optional(), language: text.optional(), day: days.optional(),
  lat: queryNumber(-90, 90, undefined), lng: queryNumber(-180, 180, undefined),
  radius: queryNumber(0.01, 200, undefined), page: queryNumber(1, 10000, 1).refine(Number.isInteger),
  limit: queryNumber(1, 100, 20).refine(Number.isInteger)
}).superRefine((v, ctx) => {
  if (v.sort === 'distance' && (v.lat === undefined || v.lng === undefined)) ctx.addIssue({ code: 'custom', message: 'La cercanía requiere lat y lng' });
  if ([v.lat, v.lng, v.radius].some(x => x !== undefined) && (v.lat === undefined || v.lng === undefined))
    ctx.addIssue({ code: 'custom', message: 'lat y lng deben proporcionarse juntos' });
});
const interaction = z.strictObject({ churchId: id, type: z.enum(['saved', 'discarded']), reason: text.max(500).optional() })
  .refine(v => v.type === 'discarded' || v.reason === undefined, 'El motivo solo corresponde al descarte');
const source = z.strictObject({ title: text, url: url.optional(), text: longText.optional(), kind: z.enum(['website', 'document', 'institutional']) })
  .refine(v => v.url || v.text, 'Se requiere url o text');
const recommendation = z.strictObject({ mode: z.enum(['traditional']).optional(), query: z.string().trim().min(1).max(2000).optional(), location: location.optional(),
  preferences: preferences.omit({ location: true }).optional(), criterionModes: require('./profile').criterionModes.optional(), limit: z.number().int().min(1).max(20).default(10) });
const profileFields = require('./profile');
const profilePatch = z.strictObject({
  addressToken: z.string().min(1).max(3000).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  username: username.optional(),
  preferences: z.strictObject(Object.fromEntries(Object.entries(preferences.shape).map(([k, value]) => [k, value.nullable().optional()]))).optional(),
  searchContext: profileFields.searchContext.optional(), criterionModes: profileFields.criterionModes.optional(),
  answerStates: profileFields.answerStates.optional(), onboarding: profileFields.onboarding.optional(),
  expectedRevision: z.number().int().nonnegative().optional()
}).refine(v => Object.keys(v).some(k => k !== 'expectedRevision'), 'Indica al menos un campo para actualizar');
function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', result.error.issues.map(x => ({ path: x.path.join('.'), message: x.message })));
  return result.data;
}
module.exports = { z, password, id, register, login, preferences, profilePatch, church, search, interaction, source, recommendation, parse };
