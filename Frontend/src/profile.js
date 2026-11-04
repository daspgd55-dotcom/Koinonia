import { catalog, denominationOptions } from './catalog.js';
export const steps = [
  { title: 'Tu identidad', heading: 'Cada búsqueda tiene un comienzo.', description: 'Cuéntanos cómo te identificas y qué buscas actualmente.', fields: ['spiritualIdentity', 'goal'] },
  { title: 'Tu tradición', heading: '¿Con qué rama te identificas?', description: 'Elige una rama o continúa sin una identificación concreta.', fields: ['branches', 'denominations'] },
  { title: 'Tu ubicación', heading: 'Una comunidad cerca de tu vida.', description: 'Indica tu comuna. La dirección y la ubicación del dispositivo son opcionales.', fields: ['commune', 'address', 'location', 'radiusKm'] }
];
export const asksDenomination = branches => branches?.some(v => ['Protestante', 'Rama Independiente'].includes(v));
export const profileSections = [
  { title: 'Identidad e intereses', fields: ['spiritualIdentity','goal','activities','ministries','targetGroups','firstVisitPreference'] },
  { title: 'Tu tradición', fields: ['branches','denominations','doctrinalTags','languages'] },
  { title: 'Tu ubicación', fields: ['commune','address','location','radiusKm','meetingDays'] }
];
export const fields = {
  spiritualIdentity: {label: '¿Cómo te identificas espiritualmente?', context: true, emptyLabel: 'Prefiero no responder', options: [['christian','Cristiano/a'],['believer','Solo creyente en Dios'],['no_religion','No me identifico con una religión'],['other_religion','Pertenezco a otra religión'],['nonbeliever','No creyente'],['other','Otro']]},
  goal: { label: '¿Qué buscas actualmente?', context: true, emptyLabel: 'Todavía no lo tengo claro', options: [['join','Encontrar una comunidad'],['explore','Explorar sin decidir todavía'],['change','Cambiar de comunidad'],['connect','Conocer otras comunidades']] },
  branches: { label: 'Rama cristiana', multiple: true, single: true, emptyLabel: 'Ninguna de las anteriores', options: catalog.branches },
  denominations: { label: 'Denominación', multiple: true, custom: true, emptyLabel: 'Sin una denominación específica', options: catalog.denominations },
  commune: { label: 'Comuna de interés', text: true, emptyLabel: 'Aún no sé dónde buscar', placeholder: 'Por ejemplo, Providencia', options: catalog.communes },
  address: { label: 'Dirección (opcional)', context: true, text: true, placeholder: 'Una dirección de referencia' },
  location: { label: 'Tu punto de partida', location: true },
  locationSource: {context:true,internal:true},
  addressSelection: {context:true,internal:true},
  radiusKm: { label: 'Distancia que te acomoda', range: true, emptyLabel: 'Sin preferencia de distancia' },
  doctrinalTags: { label: 'Doctrina, valores y prácticas', multiple: true, custom: true, options: catalog.doctrinalTags },
  activities: { label: 'Actividades', multiple: true, custom: true, options: catalog.activities },
  ministries: { label: 'Ministerios o grupos', multiple: true, custom: true, options: catalog.ministries },
  targetGroups: { label: 'Público con el que deseas participar', multiple: true, custom: true, options: catalog.targetGroups },
  meetingDays: { label: 'Días disponibles', multiple: true, options: ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'] },
  languages: { label: 'Idiomas', multiple: true, custom: true, options: catalog.languages },
  firstVisitPreference: { label: '¿Cómo prefieres preparar una visita?', context: true, options: [['information','Consultar información por mi cuenta'],['welcome','Contar con orientación de bienvenida'],['contact','Contactar antes de visitar'],['not_planned','Por ahora no planeo una visita']] }
};
export const hasValue = v => Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : v !== null && v !== undefined && String(v).trim() !== '';
export const validLocation = v => v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180;
const same=(a,b)=>String(a||'').trim().toLocaleLowerCase('es')===String(b||'').trim().toLocaleLowerCase('es');
export function effectiveLocation(draft){const v=draft.values;if(v.locationSource==='none')return null;if(v.locationSource==='address'){const p=v.addressSelection;return validLocation(p)&&same(p.address,v.address)&&same(p.commune,v.commune)?p:null;}return validLocation(v.location)?v.location:null;}
export const stateLabels = { answered: 'Respondida', no_preference: 'Sin preferencia', unknown: 'No lo sé', omitted: 'Sin responder' };
export function fromUser(user) {
  const values = {}, states = {}, modes = {};
  for (const [key, field] of Object.entries(fields)) {
    values[key] = (field.context ? user.searchContext?.[key] : user.preferences?.[key]) ?? null;
    if (key === 'meetingDays' && !values[key]?.length && user.preferences?.meetingDay) values[key] = [user.preferences.meetingDay];
    states[key] = user.answerStates?.[key] || (hasValue(values[key]) ? 'answered' : 'omitted');
    modes[key] = user.criterionModes?.[key] || 'preferred';
  }
  values.locationSource=user.searchContext?.locationSource||(validLocation(values.location)?'device':'none');states.locationSource='answered';
  values.addressSelection=user.searchContext?.addressPoint||null;states.addressSelection=values.addressSelection?'answered':'omitted';
  return { values, states, modes, dirty: [], revision: user.profileRevision || 0, flowVersion: 3,
    step: user.onboarding?.version === 3 ? Math.min(user.onboarding.lastStep || 0, 2) : 0 };
}
export function restoreDraft(user, cached) {
  const fresh = fromUser(user);
  if (!cached?.values || !cached?.states || !Array.isArray(cached.dirty)) return fresh;
  // Solo las ediciones pendientes sobrescriben el perfil recién leído; el resto se refresca.
  for (const key of cached.dirty.filter(k => fields[k])) {
    fresh.values[key] = cached.values[key] ?? null; fresh.states[key] = cached.states[key] || 'omitted'; fresh.modes[key] = cached.modes?.[key] || 'preferred';
  }
  return { ...fresh, dirty: cached.dirty.filter(k => fields[k]), revision: cached.dirty.length ? cached.revision : fresh.revision,
    step: cached.flowVersion === 3 ? Math.max(0, Math.min(cached.step || 0, 2)) : fresh.step };
}
export function patchFromDraft(draft, onboarding) {
  const body = { preferences: {}, searchContext: {}, answerStates: {}, criterionModes: {}, expectedRevision: draft.revision, ...(onboarding ? {onboarding} : {}) };
  for (const key of draft.dirty) {
    if(key==='addressSelection'){if(draft.values.addressSelection?.token)body.addressToken=draft.values.addressSelection.token;continue;}
    const field = fields[key], value = draft.values[key], answered = draft.states[key] === 'answered' && hasValue(value);
    if (answered && field.location && !validLocation(value)) throw Error('No pudimos confirmar tu ubicación. Actívala nuevamente o continúa sin ella.');
    body[field.context ? 'searchContext' : 'preferences'][key] = answered ? typeof value === 'string' ? value.trim() : value : null;
    body.answerStates[key] = answered ? 'answered' : draft.states[key] === 'answered' ? 'omitted' : draft.states[key];
    if (!field.context && !field.location) body.criterionModes[key] = answered ? draft.modes[key] : 'disabled';
  }
  if (draft.dirty.some(k => ['radiusKm','location','locationSource','addressSelection','address','commune'].includes(k)) && draft.modes.radiusKm === 'required' && draft.states.radiusKm === 'answered' && !effectiveLocation(draft)) throw Error('Confirma tu dirección o activa la ubicación del dispositivo para exigir una distancia máxima.');
  return body;
}
export function displayValue(key, draft) {
  const value = draft.values[key];
  if(key==='location'&&draft.values.locationSource==='address')return effectiveLocation(draft)?'Cerca de mi dirección':'Dirección por confirmar';
  if(key==='location'&&draft.values.locationSource==='none')return 'Sin ubicación';
  if (draft.states[key] !== 'answered' || !hasValue(value)) return draft.states[key] === 'no_preference' ? fields[key].emptyLabel || 'Sin preferencia' : stateLabels[draft.states[key]] || 'Sin responder';
  if (Array.isArray(value)) return value.join(' · ');
  if (key === 'location') return validLocation(value) ? 'Ubicación aproximada activada' : 'Sin ubicación';
  if (key === 'address') return value+(draft.values.addressSelection?' · Confirmada':' · No verificada');
  if (key === 'radiusKm') return `${value} km`;
  return fields[key].options?.find(o => Array.isArray(o) && o[0] === value)?.[1] || value;
}
export { denominationOptions };
