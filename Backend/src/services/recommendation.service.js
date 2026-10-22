const Source = require('../models/source.model');
const { z } = require('zod');
const { HttpError } = require('../utils/errors');
const normalize = value => String(value).trim().toLocaleLowerCase('es');

// Función para calcular la compatibilidad de una iglesia con las preferencias de un usuario
function overlap(wanted = [], actual = []) {
  if (!wanted.length) return 0;
  const available = new Set(actual.map(normalize));
  return wanted.filter(x => available.has(normalize(x))).length / wanted.length;
}

// Función para calcular un puntaje de compatibilidad de una iglesia con las preferencias de un usuario
const criterionPaths = {
  commune: c => c.location?.commune, denominations: c => c.christianIdentity?.denomination,
  branches: c => c.christianIdentity?.branch, doctrinalTags: c => c.doctrine?.characteristics,
  activities: c => c.community?.activities, ministries: c => c.community?.ministries,
  targetGroups: c => c.community?.targetGroups, languages: c => c.christianIdentity?.languages,
  meetingDays: c => c.meetings?.flatMap(m => (m.schedule || []).map(s => s.day))
};
function rank(church, preferences, modes = {}) {
  const criteria = {}, scores = {};
  for (const [field, read] of Object.entries(criterionPaths)) {
    const wanted = field === 'meetingDays' ? preferences.meetingDays?.length ? preferences.meetingDays : preferences.meetingDay ? [preferences.meetingDay] : [] : preferences[field];
    if (!wanted || (Array.isArray(wanted) && !wanted.length) || modes[field] === 'disabled') continue;
    const value = read(church), actual = Array.isArray(value) ? value : value ? [value] : [];
    const ratio = overlap(Array.isArray(wanted) ? wanted : [wanted], actual);
    const all = ['doctrinalTags', 'activities', 'ministries', 'targetGroups'].includes(field);
    scores[field] = all ? ratio : ratio > 0 ? 1 : 0;
    criteria[field] = { mode: modes[field] || 'required', status: !actual.length ? 'unknown' : scores[field] === 1 ? 'matched' : scores[field] > 0 ? 'partial' : 'not_matched' };
  }
  if (church.distanceMeters !== undefined && modes.radiusKm !== 'disabled') {
    const radius = preferences.radiusKm || 5;
    scores.radiusKm = Math.max(0, 1 - church.distanceMeters / (radius * 1000));
    criteria.radiusKm = { mode: modes.radiusKm || 'required', status: church.distanceMeters <= radius * 1000 ? 'matched' : 'not_matched' };
  }
  const mean = keys => { const values = keys.filter(k => scores[k] !== undefined).map(k => scores[k]); return values.length ? values.reduce((a,b) => a+b,0) / values.length : 0; };
  const informationQuality=require('./church-quality.service').quality(church);
  const components = { doctrine: mean(['denominations', 'branches', 'doctrinalTags']), distance: mean(['radiusKm', 'commune']),
    activities: mean(['activities', 'ministries', 'targetGroups']), availability: mean(['languages', 'meetingDays']),
    quality: informationQuality.score };
  const groups={doctrine:['denominations','branches','doctrinalTags'],distance:['radiusKm','commune'],activities:['activities','ministries','targetGroups'],availability:['languages','meetingDays']},weights={doctrine:.4,distance:.25,activities:.2,availability:.1};
  const active=Object.keys(groups).filter(k=>groups[k].some(f=>scores[f]!==undefined)),weight=active.reduce((sum,k)=>sum+weights[k],0);
  const affinity=weight?active.reduce((sum,k)=>sum+weights[k]*components[k],0)/weight:0;
  const score=Number((weight ? .95*affinity+.05*components.quality:components.quality).toFixed(6));
  const evidence={activeCriteria:Object.keys(criteria).length,knownCriteria:Object.values(criteria).filter(x=>x.status!=='unknown').length,informationQuality};

  return { churchId: String(church._id), score, components, criteria, evidence, church,
    explanation: 'Compatibilidad basada en criterios activos y atributos disponibles; los datos desconocidos se indican por separado y no aportan coincidencia.', sourceIds: [] };
}

// Función para determinar si una iglesia satisface las preferencias de un usuario
function satisfies(church, p) {
  const hasAny = (wanted, actual) => !wanted?.length || overlap(wanted, actual) > 0;
  return hasAny(p.denominations, [church.christianIdentity?.denomination]) && hasAny(p.branches, [church.christianIdentity?.branch])
    && hasAny(p.languages, church.christianIdentity?.languages) && (!p.doctrinalTags?.length || overlap(p.doctrinalTags, church.doctrine?.characteristics) === 1)
    && (!p.activities?.length || overlap(p.activities, church.community?.activities) === 1)
    && (!p.meetingDay || church.meetings?.some(m => m.schedule.some(s => s.day === p.meetingDay)));
}
const enrichmentSchema = z.strictObject({
  engine: z.enum(['baseline', 'rag']),
  results: z.array(z.strictObject({ churchId: z.string().regex(/^[a-fA-F0-9]{24}$/), explanation: z.string().min(1).max(4000),
    sourceIds: z.array(z.string().regex(/^[a-fA-F0-9]{24}$/)).max(20) })).max(100)
});

// Función para enriquecer un ranking de iglesias con explicaciones y fuentes externas, verificando la validez de la respuesta
async function enrich(config, query, preferences, ranked) {
  if (!config.recommenderUrl || !ranked.length) return { results: ranked, mode: 'deterministic', queryInterpreted: false };
  const sources = await Source.find({ church: { $in: ranked.map(r => r.churchId) }, status: 'approved' }).select('-createdBy -__v').sort({ _id: 1 }).limit(200).lean();
  const payload = { version: '1', query: query || '', preferences,
    candidates: ranked.map(r => ({ churchId: r.churchId, score: r.score, components: r.components,
      identification: r.church.identification, doctrine: r.church.doctrine, community: r.church.community,
      sources: sources.filter(s => String(s.church) === r.churchId).map(s => ({ id: String(s._id), title: s.title, url: s.url, text: s.text })) })) };
  let response, body;
  try {
    response = await fetch(config.recommenderUrl, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.recommenderToken ? { Authorization: 'Bearer ' + config.recommenderToken } : {}) },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(config.recommenderTimeoutMs || 5000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    // Límite durante lectura, incluso si el servidor omite Content-Length.
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length; if (bytes > 262144) throw new Error('Respuesta demasiado grande');
      chunks.push(chunk);
    }
    body = enrichmentSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    throw new HttpError(503, 'RECOMMENDER_UNAVAILABLE', 'El recomendador externo no respondió correctamente');
  }
  const seen = new Set(), byId = new Map(ranked.map(r => [r.churchId, r]));
  for (const item of body.results) {
    const row = byId.get(item.churchId);
    if (!row || seen.has(item.churchId) || item.sourceIds.some(id => !sources.some(s => String(s._id) === id && String(s.church) === item.churchId))
      || (body.engine === 'rag' && !item.sourceIds.length))
      throw new HttpError(502, 'INVALID_RECOMMENDATION', 'Respuesta sin evidencia válida o fuera de los candidatos autorizados');
    seen.add(item.churchId);
    row.explanation = item.explanation; row.sourceIds = item.sourceIds;
  }
  return { results: ranked, mode: body.engine === 'rag' ? 'rag-enriched' : 'external-baseline', queryInterpreted: false };
}

module.exports = { rank, satisfies, enrich };
