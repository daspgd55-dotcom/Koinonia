import {FriendShare} from './SocialTools';
import React,{useState} from 'react';
export default function ShareButton({path,title}){
 const [message,setMessage]=useState(''),[manual,setManual]=useState(false),[busy,setBusy]=useState(false);
 const url=new URL(window.location.pathname,window.location.origin);url.hash=path;
 async function copy(){setMessage('');try{await navigator.clipboard.writeText(url.href);setManual(false);setMessage('Enlace copiado.');}catch{setManual(true);setMessage('Selecciona el enlace para copiarlo.');}}
 async function share(){setBusy(true);setMessage('');try{if(navigator.share){await navigator.share({title,url:url.href});}else await copy();}catch(e){if(e.name!=='AbortError')await copy();}finally{setBusy(false);}}
 return <div className="share-control"><button className="secondary small follow-button" disabled={busy} onClick={share}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/></svg>Compartir</button>{typeof navigator.share==='function'&&<button className="text-button" onClick={copy}>Copiar enlace</button>}{/^\/(evento|iglesia)\/[a-f0-9]{24}$/i.test(path)&&<FriendShare key={path} resource={{type:path.startsWith('/evento/')?'event':'church',id:path.split('/')[2]}}/>}<span role="status">{message}</span>{manual&&<input aria-label="Enlace para compartir" readOnly value={url.href} onFocus={e=>e.target.select()}/>}</div>;
}
