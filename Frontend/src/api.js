import {requestCaptcha} from './Captcha';
import {beginRequest} from './requestActivity';
const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
async function request(path, { token, body, method = 'GET', headers = {}, raw = false, captchaAttempts=0, background=false, signal, timeoutMs } = {}) {
  const finish=background?()=>{}:beginRequest();
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), timeoutMs ?? (raw ? 60000 : 90000));
  const abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  try {
    const response = await fetch(base + path, { method, signal: controller.signal, headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if(data.error?.code==='CAPTCHA_REQUIRED'&&data.error.details?.captcha&&captchaAttempts<3){
        clearTimeout(timeout);
        finish();
        const proof=await requestCaptcha(data.error.details.captcha);
        return api(path,{token,body,method,raw,background,signal,headers:{...headers,'X-Captcha-Token':proof},captchaAttempts:captchaAttempts+1});
      }
      const error = Error(data.error?.message || 'No pudimos completar la solicitud. Intenta nuevamente.');
      error.details = data.error?.details; error.status = response.status; error.code = data.error?.code; throw error;
    }
    return data;
  } catch (error) {
    if(signal?.aborted)throw error;
    if (error.name === 'AbortError' || error instanceof TypeError) throw Error('No pudimos conectar. Tus respuestas siguen aquí; revisa la conexión e intenta nuevamente.');
    throw error;
  } finally { clearTimeout(timeout);signal?.removeEventListener('abort',abort);finish(); }
}
// Share only concurrent reads, never retain private/public responses after completion.
const pending=new Map();let generation=0;
export function api(path,options={}){
 const method=options.method||'GET';if(method!=='GET'){generation++;pending.clear();return request(path,options);}
 if(options.signal)return request(path,options);
 const key=JSON.stringify([generation,path,options.token||'',options.headers||{},!!options.raw,!!options.background]);
 if(pending.has(key))return pending.get(key).then(structuredClone);
 const task=request(path,options);if(pending.size<100){pending.set(key,task);task.finally(()=>{if(pending.get(key)===task)pending.delete(key);}).catch(()=>{});}return task.then(structuredClone);
}
export const storage = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* La app sigue funcionando en memoria. */ } },
  remove(key) { try { sessionStorage.removeItem(key); } catch { /* Almacenamiento restringido. */ } }
};
