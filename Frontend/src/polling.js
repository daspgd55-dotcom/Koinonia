import {reportRecoverable} from './recoverableError';
import {pollingConfig} from './clientConfig';
// Un ciclo por consumidor: espera a que termine la consulta y agrupa avisos simultáneos.
export function startPolling(load,{interval,events=[]}){
 let stopped=false,running=false,pending=false,timer=null,lastStart=0;
 const controller=new AbortController(),context={signal:controller.signal,isActive:()=>!stopped};
 const schedule=delay=>{clearTimeout(timer);if(!stopped&&!document.hidden)timer=setTimeout(run,delay);};
 async function run(){
  clearTimeout(timer);if(stopped||document.hidden)return;if(running){pending=true;return;}
  running=true;pending=false;lastStart=Date.now();
  try{await load(context);}catch{if(!stopped)reportRecoverable('polling.refresh');}finally{running=false;schedule(pending?pollingConfig.eventDebounce:interval);}
 }
 const refresh=()=>{if(stopped)return;if(document.hidden){clearTimeout(timer);return;}if(running){pending=true;return;}schedule(Math.max(0,pollingConfig.eventDebounce-(Date.now()-lastStart)));};
 const wake=()=>{if(!running)refresh();};
 for(const name of events)window.addEventListener(name,refresh);
 window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);run();
 return()=>{stopped=true;clearTimeout(timer);controller.abort();for(const name of events)window.removeEventListener(name,refresh);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
}
