import Loading from './Loading';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
let receiver,scriptPromise;
export function requestCaptcha(challenge){return new Promise((resolve,reject)=>{if(!receiver)return reject(Error('Recarga la página para realizar la comprobación.'));receiver({challenge,resolve,reject});});}
function load(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();scriptPromise=null;reject(Error());},15000);
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
  script.onload=()=>{clearTimeout(timer);resolve(window.turnstile);};script.onerror=()=>{clearTimeout(timer);script.remove();scriptPromise=null;reject(Error());};document.head.appendChild(script);
 });return scriptPromise;
}
export default function Captcha(){
 const [pending,setPending]=useState(null),[status,setStatus]=useState(''),[token,setToken]=useState(''),[revision,setRevision]=useState(0),host=useRef(),dialog=useRef(),active=useRef();
 function close(value){const p=active.current;active.current=null;setPending(null);value?p?.resolve(value):p?.reject(Error('Comprobación cancelada. Tus datos siguen en el formulario.'));}
 useEffect(()=>{receiver=p=>{if(active.current)return p.reject(Error('Ya hay una comprobación en curso.'));active.current=p;setPending(p);};return()=>{receiver=null;active.current?.reject(Error('Comprobación interrumpida.'));};},[]);
 useEffect(()=>{if(!pending)return;let disposed=false,id,provider;setToken('');setStatus('Cargando comprobación…');dialog.current?.showModal();
  load().then(t=>{if(disposed)return;provider=t;setStatus('Completa la comprobación de seguridad.');id=t.render(host.current,{sitekey:pending.challenge.siteKey,action:pending.challenge.action,size:'flexible',language:'es','response-field':false,callback:value=>{if(!disposed){setToken(value);setStatus('Comprobación lista. Puedes continuar.');}},'expired-callback':()=>{setToken('');setStatus('La comprobación venció. Pulsa Renovar.');},'error-callback':()=>{setToken('');setStatus('No pudimos cargar la comprobación. Pulsa Renovar.');return true;},'timeout-callback':()=>{setToken('');setStatus('Se agotó el tiempo. Pulsa Renovar.');}});}).catch(()=>{if(!disposed)setStatus('No pudimos conectar con la comprobación. Pulsa Renovar.');});
  const cancel=()=>close();window.addEventListener('hashchange',cancel);return()=>{disposed=true;window.removeEventListener('hashchange',cancel);if(id!==undefined)provider?.remove(id);};
 },[pending,revision]);
 return pending?createPortal(<dialog ref={dialog} className="captcha-dialog" aria-labelledby="captcha-title" onCancel={e=>{e.preventDefault();close();}}><h2 id="captcha-title">Comprobación de seguridad</h2><p role="status" aria-live="polite">{status.startsWith('Cargando')?<Loading inline label={status}/>:status}</p><div ref={host}/><div className="captcha-actions"><button type="button" onClick={()=>setRevision(n=>n+1)}>Renovar</button><button type="button" onClick={()=>close()}>Volver al formulario</button><button type="button" className="primary" disabled={!token} onClick={()=>close(token)}>Continuar</button></div></dialog>,document.body):null;
}
