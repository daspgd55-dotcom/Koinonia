import React,{useEffect,useState} from 'react';
import {api} from './api';
export default function EventInterestCount({id}){
 const [count,setCount]=useState(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true,sequence=0;setCount(null);async function load(){const n=++sequence;try{const r=await api('/events/'+id+'/interest-count');if(alive&&n===sequence){setCount(r.data.interested);setError(false);}}catch{if(alive&&n===sequence)setError(true);}}load();window.addEventListener('visits-changed',load);return()=>{alive=false;window.removeEventListener('visits-changed',load);};},[id,retry]);
 return error?<button className="text-button" onClick={()=>setRetry(n=>n+1)}>Reintentar total de Me interesa</button>:<span className="event-interest-count" role="status">{count===null?'Cargando interés…':`${count.toLocaleString('es-CL')} ${count===1?'persona interesada':'personas interesadas'}`}</span>;
}
