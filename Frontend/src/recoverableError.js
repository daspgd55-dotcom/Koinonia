import {diagnosticsConfig} from './clientConfig';
const allowed=new Set(['notifications.refresh','chat.summary','polling.refresh','auth.capabilities','representative.welcome','admin.permissions']),lastReported=new Map();
// Solo identificadores predefinidos: nunca mensajes de error, URL, cuerpos ni usuarios.
export function reportRecoverable(operation){
 if(!allowed.has(operation))return;
 const now=Date.now(),previous=lastReported.get(operation);if(previous!==undefined&&now-previous<diagnosticsConfig.repeatWindow)return;
 lastReported.set(operation,now);console.warn('[Koinonía] Operación recuperable pendiente:',operation);
}
