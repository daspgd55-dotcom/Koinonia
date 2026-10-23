import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {subscribeRequests,getRequestCount} from './requestActivity';

export default function Loading({label='Cargando…',inline=false,page=false}){
 if(inline)return <span className="loading-state loading-state--inline" role="status" aria-live="polite" aria-busy="true">{label}</span>;
 return <span className={'loading-state'+(inline?' loading-state--inline':'')+(page?' loading-state--page':'')} role="status" aria-live="polite" aria-busy="true"><picture className="loading-symbol loading-symbol--animated" aria-hidden="true"><source srcSet="/loading/koinonia-cargando.webp" type="image/webp"/><img src="/loading/koinonia-cargando-transparente.gif" alt="" width="80" height="80" decoding="async"/></picture><img className="loading-symbol loading-symbol--still" src="/loading/koinonia-simbolo.png" alt="" width="80" height="80" aria-hidden="true"/><span>{label}</span></span>;
}

// Covers operations without a local loading state, without blocking navigation.
export function RequestActivity(){
 const pending=useSyncExternalStore(subscribeRequests,getRequestCount),[visible,setVisible]=useState(false);
 useEffect(()=>{setVisible(false);if(!pending)return;const timer=setTimeout(()=>{const local=[...document.querySelectorAll('.loading-state:not(.loading-state--global .loading-state)')].some(el=>el.getClientRects().length);setVisible(!local);},350);return()=>clearTimeout(timer);},[pending]);
 return pending&&visible?<div className="loading-state--global"><Loading inline label="Procesando solicitud…"/></div>:null;
}
