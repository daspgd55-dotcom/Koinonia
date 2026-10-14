const User = require('../models/user.model');
const { HttpError } = require('../utils/errors');
const { present, fields } = require('../validation/profile');
const plain = value => value?.toObject ? value.toObject() : (value || {});
const fail = message => { throw new HttpError(400, 'VALIDATION_ERROR', message); };
function validateCriteria(preferences, modes) {
  for (const field of fields) {
    if (modes[field] && modes[field] !== 'disabled' && !present(preferences[field])) fail('El criterio obligatorio ' + field + ' requiere una respuesta');
  }
  if (modes.radiusKm === 'required' && (!Number.isFinite(preferences.location?.lat) || !Number.isFinite(preferences.location?.lng))) fail('El radio obligatorio requiere una ubicación de referencia');
  if (preferences.meetingDay && preferences.meetingDays?.length) fail('Usa meetingDay o meetingDays, no ambos');
}
async function updateProfile(user, input, { replacePreferences = false } = {}) {
  if (input.preferences?.meetingDay && input.preferences?.meetingDays?.length) fail('Usa meetingDay o meetingDays, no ambos');
  const preferences = replacePreferences ? {} : { ...plain(user.preferences) };
  const searchContext = { ...plain(user.searchContext) }, criterionModes = { ...plain(user.criterionModes) }, answerStates = { ...plain(user.answerStates) };
  if (replacePreferences) {
    for (const field of [...fields, 'location']) { delete criterionModes[field]; delete answerStates[field]; }
  }
  for (const [key, value] of Object.entries(input.preferences || {})) {
    const field = key === 'meetingDay' ? 'meetingDays' : key;
    if (key === 'meetingDay') delete preferences.meetingDays;
    if (key === 'meetingDays') delete preferences.meetingDay;
    if (value === null) delete preferences[key]; else preferences[key] = value;
    answerStates[field] = present(value) ? 'answered' : 'omitted';
    if (fields.includes(field) && !replacePreferences) criterionModes[field] = present(value) ? criterionModes[field] === 'disabled' ? 'preferred' : criterionModes[field] || 'preferred' : 'disabled';
  }
  for (const [key, value] of Object.entries(input.searchContext || {})) {
    if (value === null) delete searchContext[key]; else searchContext[key] = value;
    answerStates[key] = present(value) ? 'answered' : 'omitted';
  }
  Object.assign(criterionModes, input.criterionModes);
  for (const [key, state] of Object.entries(input.answerStates || {})) {
    const value = key in searchContext ? searchContext[key] : key === 'meetingDays' ? preferences.meetingDays?.length ? preferences.meetingDays : preferences.meetingDay : preferences[key];
    if (state === 'answered' && !present(value)) fail('La respuesta ' + key + ' no tiene un valor');
    if (state !== 'answered' && present(value) && present(input.preferences?.[key] ?? (key === 'meetingDays' ? input.preferences?.meetingDay : input.searchContext?.[key]))) fail('No combines valores con una respuesta ' + state);
    answerStates[key] = state;
    if (state !== 'answered') {
      delete preferences[key]; delete searchContext[key];
      if (key === 'meetingDays') delete preferences.meetingDay;
      if (fields.includes(key)) {
        if (input.criterionModes?.[key] && input.criterionModes[key] !== 'disabled') fail('Una respuesta vacía no puede aplicar criterios');
        criterionModes[key] = 'disabled';
      }
    }
  }
  if (!replacePreferences && !present(preferences.radiusKm) && !criterionModes.radiusKm) criterionModes.radiusKm = 'disabled';
  const effective = { ...preferences, meetingDay: undefined, meetingDays: preferences.meetingDays?.length ? preferences.meetingDays : preferences.meetingDay ? [preferences.meetingDay] : undefined };
  // El PUT anterior permite radio sin coordenadas: conserva ese contrato.
  const distanceTouched = ['radiusKm','location'].some(k => Object.hasOwn(input.preferences || {}, k) || Object.hasOwn(input.answerStates || {}, k)) || Object.hasOwn(input.criterionModes || {}, 'radiusKm');
  validateCriteria(effective, replacePreferences || !distanceTouched ? { ...criterionModes, radiusKm: undefined } : criterionModes);
  const now = new Date(), onboarding = { status: 'pending', version: 1, lastStep: 0, ...plain(user.onboarding), ...input.onboarding, updatedAt: now };
  if (onboarding.version === 3 && onboarding.lastStep > 3) fail('La incorporación v3 tiene tres fases');
  if (onboarding.version === 2 && onboarding.lastStep > 4) fail('La incorporación v2 tiene cuatro pasos');
  if (input.onboarding?.status === 'completed' && !onboarding.completedAt) onboarding.completedAt = now;
  if (input.onboarding?.status && input.onboarding.status !== 'completed') delete onboarding.completedAt;
  const revision = user.profileRevision || 0;
  if (input.expectedRevision !== undefined && input.expectedRevision !== revision) throw new HttpError(409, 'STALE_PROFILE', 'Recarga el perfil antes de guardar');
  const updated = await User.findOneAndUpdate({ _id: user._id, $or: [{ profileRevision: revision }, ...(revision === 0 ? [{ profileRevision: { $exists: false } }] : [])] },
    { $set: { ...(input.name!==undefined?{name:input.name}:{}), ...(input.username!==undefined?{username:input.username}:{}), preferences, searchContext, criterionModes, answerStates, onboarding }, $inc: { profileRevision: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new HttpError(409, 'STALE_PROFILE', 'El perfil cambió durante el guardado; recárgalo');
  return updated;
}
module.exports = { updateProfile, validateCriteria, plain };
