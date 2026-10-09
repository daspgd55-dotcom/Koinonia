'use strict';
const $ = selector => document.querySelector(selector);
const state = { token: null, user: null, mode: 'public', page: 1, pages: 0, current: null, working: {}, readonly: false, dirty: false, jsonDirty: false, busy: false, requests: 0 };
const editableKeys = ['identification', 'verification', 'location', 'christianIdentity', 'doctrine', 'meetings', 'community', 'leadership', 'contact', 'firstVisit', 'media'];
const statusLabels = { draft: 'Borrador', published: 'Publicada', verified: 'Verificada' };
const manager = () => ['admin', 'representative'].includes(state.user?.role);

// Función para mostrar un mensaje de aviso o error en la interfaz
function notice(message, error = false, inEditor = $('#editor').open) {
  const box = $(inEditor ? '#editor-notice' : '#notice');
  box.textContent = message; box.hidden = !message; box.className = error ? 'error' : '';
}


// Función para redactar valores sensibles
function redact(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /password|token|authorization/i.test(key) ? '[oculto]' : redact(item)]));
}

// Función para registrar solicitudes y respuestas de la API en la interfaz
function logRequest(method, path, status, duration, body, response) {
  const item = document.createElement('li'), summary = document.createElement('div'), details = document.createElement('details'), label = document.createElement('summary'), pre = document.createElement('pre');
  summary.textContent = method + ' ' + path + ' · ' + status + ' · ' + duration + ' ms'; summary.className = status >= 200 && status < 300 ? 'success' : 'failed';
  label.textContent = 'Ver solicitud y respuesta';
  pre.textContent = JSON.stringify({ request: redact(body ?? null), response: redact(response) }, null, 2).slice(0, 40000);
  details.append(label, pre); item.append(summary, details); $('#request-log').prepend(item);
  while ($('#request-log').children.length > 30) $('#request-log').lastChild.remove();
  $('#trace-count').textContent = ++state.requests + ' solicitudes (últimas 30)';
}

// Función para realizar solicitudes a la API
async function api(path, { method = 'GET', body, version } = {}) {
  const start = performance.now(), headers = { Accept: 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (version !== undefined) headers['If-Match'] = '"' + version + '"';
  let response, data;
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    data = response.status === 204 ? null : await response.json();
  } catch {
    logRequest(method, path, 'sin respuesta', Math.round(performance.now() - start), body, 'No se recibió JSON válido de la API.');
    throw new Error('No se pudo completar la solicitud. Comprueba el servidor y recarga para verificar si el cambio llegó a guardarse.');
  }
  logRequest(method, path, response.status, Math.round(performance.now() - start), body, data);
  if (!response.ok) {
    if (response.status === 401 && state.token) { clearSession(); $('#editor').close(); }
    const detail = data?.error?.details;
    const lines = Array.isArray(detail) ? detail.map(x => typeof x === 'string' ? x : (x.path ? x.path + ': ' : '') + x.message) : [];
    throw new Error((data?.error?.message || 'Error HTTP ' + response.status) + (lines.length ? '\n• ' + lines.join('\n• ') : ''));
  }
  return data;
}

// Función para habilitar o deshabilitar botones y campos según el estado de la aplicación
function syncButtons() {
  document.querySelectorAll('button').forEach(button => { button.disabled = state.busy; });
  $('#manage-mode').disabled = state.busy || !manager(); $('#new-church').disabled = state.busy || state.user?.role !== 'admin';
  $('#previous').disabled = state.busy || state.page <= 1; $('#next').disabled = state.busy || state.page >= state.pages;
  const editable = !state.readonly && state.current?.active !== false && manager();
  $('#editable-fields').disabled = state.busy || !editable;
  $('#save-church').disabled = state.busy || !editable;
  document.body.classList.toggle('busy', state.busy);
}

// Función para ejecutar una acción que puede tardar.
async function run(action) {
  if (state.busy) return;
  state.busy = true; syncButtons();
  try { await action(); } catch (error) { notice(error.message, true); }
  finally { state.busy = false; syncButtons(); }
}

// Función para mostrar un diálogo de confirmación antes de realizar una acción
async function confirmAction(title, message, action = 'Confirmar') {
  $('#confirm-title').textContent = title; $('#confirm-message').textContent = message; $('#confirm-action').textContent = action;
  const dialog = $('#confirm-dialog'); dialog.returnValue = 'cancel'; dialog.showModal();
  // Este diálogo se mantiene operativo aunque la solicitud haya bloqueado los otros botones.
  dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}

// Función para verificar si se pueden descartar los cambios sin guardar
async function canDiscard() {
  return !state.dirty || await confirmAction('Cambios sin guardar', 'Se perderán los cambios que tienes en el formulario.', 'Descartar cambios');
}

// Función para actualizar la interfaz según el estado de la sesión y el modo de visualización
function updateSession() {
  $('#identity').textContent = state.user ? state.user.email + ' · ' + ({ admin: 'Administrador', representative: 'Representante', user: 'Usuario' }[state.user.role]) : 'Exploración pública';
  $('#login-form').hidden = !!state.user; $('#logout').hidden = !state.user;
  $('#public-mode').setAttribute('aria-pressed', state.mode === 'public'); $('#manage-mode').setAttribute('aria-pressed', state.mode === 'manage');
  document.querySelectorAll('.management-only').forEach(el => { el.hidden = state.mode !== 'manage'; });
  document.querySelectorAll('.public-only').forEach(el => { el.hidden = state.mode !== 'public'; });
  $('#mode-description').textContent = state.mode === 'manage' ? 'Solo comunidades que puedes administrar' : 'Fichas activas y publicadas';
}

// Función para limpiar la sesión y restablecer el estado de la aplicación
function clearSession() {
  state.token = null; state.user = null; state.mode = 'public'; state.page = 1; state.current = null; state.dirty = false;
  $('#password').value = ''; updateSession();
}

// Función para generar los parámetros de búsqueda según el formulario y el estado actual
function searchParams() {
  const fields = new FormData($('#search-form')), params = new URLSearchParams({ page: state.page, limit: 10 });
  const keys = state.mode === 'manage' ? ['q', 'commune', 'denomination', 'status', 'active'] : ['q', 'commune', 'denomination', 'lat', 'lng', 'radius'];
  for (const key of keys) if (String(fields.get(key) || '').trim()) params.set(key, fields.get(key).trim());
  return params;
}

// Función para cargar la lista de iglesias según los filtros y la paginación
async function loadList() {
  const result = await api('/api/churches' + (state.mode === 'manage' ? '/manage' : '') + '?' + searchParams());
  const page = result.pagination; state.pages = page.pages ?? Math.ceil(page.total / page.limit);
  if (state.page > Math.max(state.pages, 1)) { state.page = Math.max(state.pages, 1); return loadList(); }
  $('#result-count').textContent = page.total + ' comunidades encontradas';
  $('#page-label').textContent = 'Página ' + state.page + ' de ' + Math.max(state.pages, 1);
  $('#church-rows').replaceChildren();
  for (const church of result.data) {
    const tr = document.createElement('tr'), name = document.createElement('td'), strong = document.createElement('strong'), sub = document.createElement('small');
    strong.textContent = church.identification.name; sub.textContent = church._id; name.append(strong, sub);
    const commune = document.createElement('td'); commune.textContent = church.location.commune;
    const status = document.createElement('td'), badge = document.createElement('span');
    badge.className = 'badge ' + (church.active === false ? 'inactive' : church.metadata.dataStatus);
    badge.textContent = church.active === false ? 'Desactivada' : statusLabels[church.metadata.dataStatus]; status.append(badge);
    const source = document.createElement('td'); source.textContent = church.externalProfile ? 'Google Maps' : 'Registro manual';
    if (church.metadata.testData) { const tag = document.createElement('small'); tag.textContent = 'Publicación de prueba'; source.append(tag); }
    const action = document.createElement('td'), button = document.createElement('button'); button.className = 'row-button';
    button.textContent = state.mode === 'manage' ? 'Gestionar' : 'Ver ficha';
    button.addEventListener('click', () => run(() => openChurch(church._id, state.mode === 'public'))); action.append(button);
    tr.append(name, commune, status, source, action); $('#church-rows').append(tr);
  }
  if (!result.data.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.className = 'empty'; td.textContent = 'No hay comunidades para estos filtros.'; tr.append(td); $('#church-rows').append(tr); }
}

// Función para proyectar solo los campos editables de una iglesia, eliminando datos sensibles o internos
function projectEditable(church) {
  const copy = structuredClone(Object.fromEntries(editableKeys.filter(key => church[key] !== undefined).map(key => [key, church[key]])));
  if (copy.verification) delete copy.verification.lastUpdated;
  return copy;
}

//función para obtener un valor de un objeto según una ruta de propiedades, y para establecer un valor en un objeto según una ruta de propiedades
function getPath(obj, path) { return path.split('.').reduce((value, key) => value?.[key], obj); }

//función para establecer un valor en un objeto según una ruta de propiedades.
function setPath(obj, path, value) {
  const keys = path.split('.'), last = keys.pop(); let parent = obj;
  for (const key of keys) { if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) parent[key] = {}; parent = parent[key]; }
  if (value === undefined) delete parent[last]; else parent[last] = value;
}

// Función para eliminar propiedades con valor undefined o con objetos vacíos de un objeto, de manera recursiva
function prune(obj) {
  if (Array.isArray(obj)) return obj.map(prune);
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, prune(value)]).filter(([, value]) => value !== undefined && !(value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length)));
}

// Función para aplicar los cambios del formulario a la copia de trabajo, validando los campos y generando un objeto JSON limpio
function collectForm() {
  if (state.jsonDirty) throw new Error('Tienes cambios en el editor JSON. Pulsa “Aplicar JSON al formulario” antes de guardar.');
  const doc = structuredClone(state.working);
  $('#editable-fields').querySelectorAll('[data-path]').forEach(input => {
    let value = input.value.trim();
    value = input.dataset.kind === 'list' ? value.split(';').map(x => x.trim()).filter(Boolean) : value === '' ? undefined : input.type === 'number' ? Number(value) : value;
    setPath(doc, input.dataset.path, value);
  });
  setPath(doc, 'location.coordinates', { type: 'Point', coordinates: [Number($('#church-lng').value), Number($('#church-lat').value)] });
  setPath(doc, 'verification.authorized', $('#authorized').checked);
  try { doc.meetings = JSON.parse($('#meetings').value); } catch { throw new Error('El JSON de reuniones no es válido.'); }
  return prune(doc);
}

// Función para llenar los campos del formulario con los valores de un documento, y actualizar la copia de trabajo
function fillFields(doc) {
  state.working = structuredClone(doc);
  $('#editable-fields').querySelectorAll('[data-path]').forEach(input => {
    const value = getPath(doc, input.dataset.path); input.value = input.dataset.kind === 'list' ? (Array.isArray(value) ? value.join('; ') : '') : value ?? '';
  });
  $('#church-lng').value = doc.location?.coordinates?.coordinates?.[0] ?? '';
  $('#church-lat').value = doc.location?.coordinates?.coordinates?.[1] ?? '';
  $('#authorized').checked = doc.verification?.authorized === true; $('#meetings').value = JSON.stringify(doc.meetings || [], null, 2);
  $('#advanced-json').value = JSON.stringify(doc, null, 2); state.jsonDirty = false; $('#advanced-status').textContent = '';
}

// Función para renderizar el editor de iglesia con los datos de la iglesia actual, y actualizar la interfaz según el modo de edición o consulta
function renderEditor(church, readonly = false) {
  state.current = church; state.readonly = readonly; state.dirty = false;
  $('#church-form').reset(); fillFields(church ? projectEditable(church) : { identification: {}, location: {}, meetings: [] });
  $('#editor-title').textContent = church?.identification.name || 'Nueva comunidad';
  $('#editor-mode').textContent = readonly ? 'CONSULTA PÚBLICA' : church ? 'GESTIÓN DE FICHA' : 'NUEVO BORRADOR';
  $('#editor-state').textContent = church ? (church.active ? statusLabels[church.metadata.dataStatus] : 'Desactivada') + ' · Versión ' + church.metadata.version + (church.metadata.testData ? ' · Publicación de prueba' : '') : 'Nombre, comuna y coordenadas son obligatorios.';
  $('#readonly-hint').hidden = !readonly; $('#save-church').hidden = readonly || church?.active === false;
  $('#save-hint').textContent = readonly ? 'Este formulario está en modo de consulta.' : church?.active === false ? 'Restaura la comunidad para poder editarla.' : 'Guardar devuelve la ficha a borrador para revisión.';
  $('#record-actions').hidden = readonly || !church;
  document.querySelectorAll('.admin-only').forEach(el => { el.hidden = state.user?.role !== 'admin' || church?.active === false; });
  $('#deactivate-church').hidden = state.user?.role !== 'admin' || church?.active === false; $('#restore-church').hidden = state.user?.role !== 'admin' || church?.active !== false;
  $('#representatives').value = church?.representatives?.join(', ') || '';
  $('#raw-document').textContent = JSON.stringify(church || {}, null, 2); $('#editor-notice').hidden = true;
  if (!$('#editor').open) $('#editor').showModal();
  syncButtons();
}

// Función para abrir la ficha de una iglesia
async function openChurch(id, readonly = false) {
  const result = await api('/api/churches/' + (readonly ? '' : 'manage/') + id); renderEditor(result.data, readonly);
}

// Función para mutar la iglesia actual mediante una solicitud a la API, y actualizar la lista y el editor según el resultado.
async function mutateCurrent(path, method, body, message) {
  const id = state.current._id;
  const result = await api('/api/churches/' + id + path, { method, body, version: state.current.metadata.version });
  if (result?.data) renderEditor(result.data); else await openChurch(id);
  await loadList(); notice(message);
}
$('#login-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  const result = await api('/api/auth/login', { method: 'POST', body: { email: $('#email').value, password: $('#password').value } });
  state.token = result.token; state.user = result.data; $('#password').value = ''; state.mode = manager() ? 'manage' : 'public'; state.page = 1;
  updateSession(); await loadList(); notice('Sesión iniciada. Las operaciones respetan los permisos de tu cuenta.');
}); });
$('#logout').addEventListener('click', () => run(async () => { if (!await canDiscard()) return; $('#editor').close(); clearSession(); await loadList(); notice('Sesión cerrada en esta pestaña.'); }));
for (const [selector, mode] of [['#public-mode', 'public'], ['#manage-mode', 'manage']]) $(selector).addEventListener('click', () => run(async () => { state.mode = mode; state.page = 1; updateSession(); await loadList(); notice(''); }));
$('#search-form').addEventListener('submit', event => { event.preventDefault(); run(async () => { state.page = 1; await loadList(); notice(''); }); });
$('#reset-search').addEventListener('click', () => run(async () => { $('#search-form').reset(); state.page = 1; await loadList(); notice(''); }));
$('#previous').addEventListener('click', () => run(async () => { state.page--; await loadList(); }));
$('#next').addEventListener('click', () => run(async () => { state.page++; await loadList(); }));
$('#new-church').addEventListener('click', () => renderEditor(null));
async function closeEditor() { if (await canDiscard()) { state.dirty = false; $('#editor').close(); } }
$('#close-editor').addEventListener('click', closeEditor);
$('#editor').addEventListener('cancel', event => { event.preventDefault(); if (!state.busy) closeEditor(); });
$('#church-form').addEventListener('input', event => {
  state.dirty = true;
  if (event.target === $('#advanced-json')) { state.jsonDirty = true; $('#advanced-status').textContent = 'Cambios JSON pendientes de aplicar.'; }
});
$('#church-form').addEventListener('change', event => {
  if (event.target !== $('#advanced-json') && !state.jsonDirty) {
    try { $('#advanced-json').value = JSON.stringify(collectForm(), null, 2); } catch { /* La validación se muestra al guardar. */ }
  }
});
$('#apply-json').addEventListener('click', () => {
  try {
    const doc = JSON.parse($('#advanced-json').value);
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('Usa un objeto JSON.');
    if (Object.keys(doc).some(key => !editableKeys.includes(key))) throw new Error('El JSON contiene campos técnicos o desconocidos que no se pueden editar.');
    fillFields(doc); state.dirty = true; notice('JSON aplicado. Guarda el formulario para enviarlo a la API.');
  } catch (error) { notice('No se pudo aplicar el JSON: ' + error.message, true); }
});
$('#sample-meeting').addEventListener('click', () => {
  try {
    const meetings = JSON.parse($('#meetings').value); if (!Array.isArray(meetings)) throw new Error('Las reuniones deben ser un arreglo JSON.');
    meetings.push({ type: 'Reunión de prueba', modality: 'Presencial', schedule: [{ day: 'Domingo', startTime: '10:00', durationMinutes: 90 }] });
    $('#meetings').value = JSON.stringify(meetings, null, 2); state.dirty = true; $('#meetings').dispatchEvent(new Event('change', { bubbles: true }));
  } catch (error) { notice(error.message, true); }
});
$('#church-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  const body = collectForm(), current = state.current;
  const result = await api('/api/churches' + (current ? '/' + current._id : ''), { method: current ? 'PUT' : 'POST', body, version: current?.metadata.version });
  state.mode = 'manage'; updateSession(); renderEditor(result.data); await loadList(); notice(current ? 'Cambios guardados. La ficha volvió a borrador.' : 'Comunidad creada correctamente como borrador.');
}); });
$('#reload-church').addEventListener('click', () => run(async () => { if (await canDiscard()) await openChurch(state.current._id); }));
for (const [selector, status] of [['#draft-church', 'draft'], ['#publish-church', 'published'], ['#verify-church', 'verified']]) $(selector).addEventListener('click', () => run(async () => {
  if (state.dirty) throw new Error('Guarda o recarga los cambios del formulario antes de modificar el estado.');
  if (!await confirmAction('Cambiar estado', 'La ficha «' + state.current.identification.name + '» pasará a ' + statusLabels[status].toLowerCase() + '.', 'Cambiar estado')) return;
  await mutateCurrent('/status', 'PATCH', { status }, 'Estado actualizado: ' + statusLabels[status] + '.');
}));
$('#deactivate-church').addEventListener('click', () => run(async () => {
  if (state.dirty) throw new Error('Guarda o recarga los cambios antes de desactivar.');
  if (!await confirmAction('Desactivar comunidad', '«' + state.current.identification.name + '» dejará de aparecer en el catálogo público. Sus datos se conservarán.', 'Desactivar')) return;
  await mutateCurrent('', 'DELETE', undefined, 'Comunidad desactivada. Puedes restaurarla desde esta ficha.');
}));
$('#restore-church').addEventListener('click', () => run(async () => {
  if (!await confirmAction('Restaurar comunidad', 'La comunidad quedará activa como borrador, pendiente de publicación.', 'Restaurar')) return;
  await mutateCurrent('/restore', 'POST', undefined, 'Comunidad restaurada como borrador.');
}));
$('#assign-representatives').addEventListener('click', () => run(async () => {
  if (state.dirty) throw new Error('Guarda o recarga los cambios antes de asignar representantes.');
  const userIds = $('#representatives').value.split(',').map(x => x.trim()).filter(Boolean);
  if (!await confirmAction('Asignar representantes', 'Se reemplazará la lista de usuarios autorizados para administrar esta comunidad.', 'Asignar')) return;
  await mutateCurrent('/representatives', 'PUT', { userIds }, 'Representantes actualizados.');
}));
window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
updateSession();
run(async () => {
  try { await api('/health'); $('#health').textContent = ''; $('#health-dot').className = 'dot ok'; }
  catch { $('#health').textContent = 'API no disponible'; $('#health-dot').className = 'dot error'; }
  await loadList();
});
