const { z, id, church } = require('./schemas');
const types = ['youth', 'ministry', 'volunteering', 'organization', 'movement', 'other'];
const statuses = ['draft', 'published', 'archived'];
const text = z.string().trim().min(1).max(200);
const ownLocation = church.shape.location.pick({ address: true, commune: true, city: true, region: true, postalCode: true, countryCode: true, coordinates: true }).partial({ coordinates: true });
const location = z.discriminatedUnion('mode', [z.strictObject({ mode: z.literal('none') }), z.strictObject({ mode: z.literal('church') }), z.strictObject({ mode: z.literal('custom'), custom: ownLocation })]);
const fields = z.strictObject({
  name: text, type: z.enum(types), description: z.string().trim().max(10000).default(''),
  audience: z.array(text).max(50).default([]), leaders: z.array(z.strictObject({ name: text, role: text })).max(50).default([]),
  contact: church.shape.contact.unwrap().default({}),
  privateFields: z.strictObject({ email: z.boolean().default(false), phone: z.boolean().default(false) }).default({ email: false, phone: false }),
  location: location.default({ mode: 'none' }),
  media: church.shape.media.unwrap().element.omit({ leaderId: true, category: true }).array().max(7).default([])
});
const create = fields.extend({ churchId: id });
const patch = z.strictObject(Object.fromEntries(Object.entries(fields.shape).map(([key, value]) => [key, (value instanceof z.ZodDefault ? value.removeDefault() : value).optional()]))).refine(v => Object.keys(v).length > 0, 'Indica al menos un campo');
const status = z.strictObject({ status: z.enum(statuses) });
const query = z.strictObject({ churchId: id.optional(), type: z.enum(types).optional(), q: text.optional(), page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
module.exports = { types, statuses, create, patch, status, query, managedQuery: query.extend({ status: z.enum(statuses).optional() }) };
