const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export async function api(path, { token, body, method = 'GET', headers = {}, raw = false } = {}) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), raw ? 60000 : 90000);
  try {
    const response = await fetch(base + path, { method, signal: controller.signal, headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = Error(data.error?.message || 'No pudimos completar la solicitud. Intenta nuevamente.');
      error.details = data.error?.details; error.status = response.status; error.code = data.error?.code; throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw Error('No pudimos conectar. Tus respuestas siguen aquí; revisa la conexión e intenta nuevamente.');
    throw error;
  } finally { clearTimeout(timeout); }
}
export const storage = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* La app sigue funcionando en memoria. */ } },
  remove(key) { try { sessionStorage.removeItem(key); } catch { /* Almacenamiento restringido. */ } }
};
