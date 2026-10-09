const { z, church } = require('./schemas');
const text = z.string().trim().min(1).max(10000);
const httpUrl = z.string().url().max(4000).refine(value => {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
});
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const openingDay = z.strictObject({
  day: z.enum(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']),
  raw: text,
  status: z.enum(['closed', 'open24h', 'intervals', 'unparsed']),
  intervals: z.array(z.strictObject({ startTime: time, endTime: time, endDayOffset: z.union([z.literal(0), z.literal(1)]) })).max(20)
});
const externalProfile = z.strictObject({
  provider: z.literal('google_maps'), placeId: z.string().regex(/^[A-Za-z0-9_-]{5,200}$/), mapsUrl: httpUrl,
  sourceTitle: text, subtitle: text.optional(), categories: z.array(text).max(50), sourceAddress: text, sourceCity: text,
  capturedAt: z.iso.datetime(), openingHours: z.array(openingDay).max(7),
  links: z.array(z.strictObject({ kind: text, url: httpUrl })).max(100).optional(),
  phones: z.array(z.string().regex(/^\+56\d{9}$/)).max(30).optional(),
  emails: z.array(z.string().email()).max(30).optional(),
  capturedAtBasis: z.enum(['scrapedAt', 'export_filename_timezone_unknown']).optional()
});
// Las comprobaciones relacionales se aplican en validateRecord; este contrato también se exporta como JSON Schema.
const importRecord = z.strictObject({
  schemaVersion: z.literal('koinonia.church-import.v1'),
  externalKey: z.string().min(1).max(250),
  provenance: z.strictObject({ batchId: z.string().min(1).max(200), sourceFile: z.string().min(1).max(255),
    sourceRow: z.number().int().min(2), issues: z.array(z.string().min(1).max(200)).max(50) }),
  church: church.extend({ externalProfile, verification: z.strictObject({ source: z.literal('google_maps'), authorized: z.literal(false) }) })
});
function validateRecord(raw) {
  const record = importRecord.parse(raw), profile = record.church.externalProfile;
  if (record.externalKey !== profile.provider + ':' + profile.placeId) throw new Error('externalKey no coincide con provider/placeId');
  const url = new URL(profile.mapsUrl);
  if (!(url.hostname === 'google.com' || url.hostname.endsWith('.google.com')) || url.searchParams.get('query_place_id') !== profile.placeId)
    throw new Error('mapsUrl no coincide con placeId o no pertenece a Google Maps');
  if (new Set(profile.openingHours.map(day => day.day)).size !== profile.openingHours.length) throw new Error('Días de apertura duplicados');
  for (const day of profile.openingHours) {
    if ((day.status === 'intervals') !== (day.intervals.length > 0)) throw new Error('Estado de apertura incompatible con intervalos');
    for (const interval of day.intervals) {
      if (interval.startTime === interval.endTime || interval.endDayOffset !== Number(interval.endTime < interval.startTime))
        throw new Error('Intervalo de apertura inválido');
    }
  }
  return record;
}
module.exports = { importRecord, validateRecord };
