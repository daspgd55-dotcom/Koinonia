import React,{useContext,useEffect,useState} from 'react';
import {SessionContext} from './Membership';
import {api} from './api';
export default function SaveChurch({id}){
 const {user,token}=useContext(SessionContext),[saved,setSaved]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setReady(false);setError('');if(token)api('/users/me/interactions?type=saved&churchId='+id+'&limit=1',{token}).then(r=>{if(live){setSaved(r.data.length>0);setReady(true);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[token,id,retry]);
 async function toggle(){setBusy(true);setError('');try{await api(saved?'/interactions/'+id:'/interactions',{token,method:saved?'DELETE':'POST',...(!saved?{body:{churchId:id,type:'saved'}}:{})});setSaved(!saved);}catch(e){setError(e.message);}finally{setBusy(false);}}
 const icon=<svg aria-hidden="true" width="17" height="19" viewBox="0 0 24 24" fill={saved?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8"><path d="M6 3h12v18l-6-4-6 4Z"/></svg>;
 return <>{user?<button className="secondary small follow-button" aria-pressed={saved} disabled={busy||!ready} onClick={toggle}>{icon}{busy?'Guardando…':saved?'Iglesia guardada':'Guardar iglesia'}</button>:<a className="secondary small follow-button" href={'#/login?visita='+id}>{icon}Guardar iglesia</a>}{error&&<span role="alert">{error}{!ready&&<button className="text-button" onClick={()=>setRetry(n=>n+1)}>Reintentar guardadas</button>}</span>}</>;
}
