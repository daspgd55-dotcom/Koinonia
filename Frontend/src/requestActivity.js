let pending=0;
const listeners=new Set(),notify=()=>listeners.forEach(fn=>fn());
export const subscribeRequests=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const getRequestCount=()=>pending;
export function beginRequest(){pending++;notify();let done=false;return()=>{if(done)return;done=true;pending--;notify();};}
