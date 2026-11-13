const Interaction = require('../models/interaction.model'), Church = require('../models/church.model');
const { discoverable, exact, publicChurch } = require('../services/church.service');
const { rank, enrich } = require('../services/recommendation.service');
const { validateCriteria, plain } = require('../services/profile.service');
const v = require('../validation/schemas');
exports.recommend = async (req, res) => {
  const input = v.parse(v.recommendation, req.body), stored = plain(req.user.preferences);
  if (input.preferences?.meetingDay && input.preferences?.meetingDays?.length) throw new (require('../utils/errors').HttpError)(400, 'VALIDATION_ERROR', 'Usa meetingDay o meetingDays, no ambos');
  const preferences = { ...stored, ...input.preferences }, modes = { ...plain(req.user.criterionModes), ...input.criterionModes };
  if (input.preferences?.meetingDay !== undefined) delete preferences.meetingDays;
  if (input.preferences?.meetingDays !== undefined) delete preferences.meetingDay;
  const location = input.location || require('../services/address-location.service').referenceLocation(stored,plain(req.user.searchContext));
  const days = preferences.meetingDays?.length ? preferences.meetingDays : preferences.meetingDay ? [preferences.meetingDay] : [];
  for (const [key, value] of Object.entries(input.preferences || {})) if (Array.isArray(value) && !value.length && !input.criterionModes?.[key]) modes[key] = 'disabled';
  validateCriteria({ ...preferences, location, meetingDay: undefined, meetingDays: days }, modes);
  const required = key => !modes[key] || modes[key] === 'required';
  const filter = { ...discoverable };
  if (preferences.commune && required('commune')) filter['location.commune'] = exact(preferences.commune);
  for (const [key, path, operator] of [
    ['denominations', 'christianIdentity.denomination', '$in'], ['branches', 'christianIdentity.branch', '$in'],
    ['languages', 'christianIdentity.languages', '$in'], ['doctrinalTags', 'doctrine.characteristics', '$all'],
    ['activities', 'community.activities', '$all'], ['ministries', 'community.ministries', '$all'], ['targetGroups', 'community.targetGroups', '$all']
  ]) if (preferences[key]?.length && required(key)) filter[path] = { [operator]: preferences[key].map(exact) };
  if (days.length && required('meetingDays')) filter['meetings.schedule.day'] = { $in: days };
  const discarded = await Interaction.find({ user: req.user._id, type: 'discarded' }).distinct('church');
  if (discarded.length) filter._id = { $nin: discarded };
  const personalized = Object.keys(modes).length > 0;
  let cursor;
  if (location?.lat !== undefined && location?.lng !== undefined) {
    const geo = { near: { type: 'Point', coordinates: [location.lng, location.lat] }, key: 'location.coordinates', distanceField: 'distanceMeters', spherical: true, query: filter };
    if (required('radiusKm')) geo.maxDistance = (preferences.radiusKm || 5) * 1000;
    const pipeline = [{ $geoNear: geo }, { $sort: { distanceMeters: 1, _id: 1 } }];
    if (!personalized) pipeline.push({ $limit: 101 });
    cursor = Church.aggregate(pipeline).cursor({ batchSize: 100 });
  } else cursor = (personalized ? Church.find(filter).sort({ _id: 1 }) : Church.find(filter).sort({ _id: 1 }).limit(101)).lean().cursor();
  const ranked = []; let evaluated = 0, truncated = false;
  try {
    for await (const candidate of cursor) {
      if (!personalized && evaluated === 100) { truncated = true; break; }
      evaluated++; const row=rank(publicChurch(candidate), preferences, modes);
      let low=0,high=ranked.length;while(low<high){const mid=(low+high)>>>1,order=ranked[mid].score-row.score||row.churchId.localeCompare(ranked[mid].churchId);if(order<0)high=mid;else low=mid+1;}
      ranked.splice(low,0,row);
      if (ranked.length > input.limit) ranked.pop();
    }
  } finally { await cursor.close(); }
  const saved=new Set((await Interaction.find({user:req.user._id,type:'saved',church:{$in:ranked.map(r=>r.churchId)}}).distinct('church')).map(String));
  for(const row of ranked)row.saved=saved.has(row.churchId);
  delete preferences.location;
  const effectivePreferences = Object.fromEntries(Object.entries(preferences).filter(([key]) => modes[key === 'meetingDay' ? 'meetingDays' : key] !== 'disabled'));
  const result = input.mode === 'traditional' ? { results: ranked, mode: 'deterministic', queryInterpreted: false } : await enrich(req.app.locals.config, input.query, effectivePreferences, ranked);
  res.json({ data: result.results, meta: { mode: result.mode, queryInterpreted: result.queryInterpreted,
    candidateLimit: personalized ? null : 100, evaluatedCandidates: evaluated, truncated, criterionModes: modes,
    warnings: [ ...(input.query ? ['La consulta libre no se interpreta todavía; configura criterios estructurados.'] : []),
      ...(truncated ? ['Se evaluaron solo los primeros 100 candidatos; restringe tu búsqueda.'] : []) ] } });
};
