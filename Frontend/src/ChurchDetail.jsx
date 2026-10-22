import Loading from './Loading';
import ChurchPresentation from './ChurchPresentation';
import React,{useEffect,useState} from 'react';
import {api} from './api';
function Alert({children}){return children?<div className="notice error" role="alert">{children}</div>:null;}
export default function ChurchDetail({id,discovery,supplied,saved}){
 const [church,setChurch]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(supplied)return;let alive=true;api('/churches/'+encodeURIComponent(id)).then(r=>{if(alive)setChurch(r.data);}).catch(e=>{if(alive)setError(e.status===404?'Esta comunidad no está disponible.':e.message);});return()=>{alive=false;};},[id,retry,supplied]);
 const c=supplied||church;
 return <div className="church-detail"><a href={saved?'#/guardadas':discovery?'#/descubrir':'#/explorar'}>{saved?'← Volver a guardadas':discovery?'← Volver a descubrimiento':'← Volver a resultados'}</a>{error?<><Alert>{error}</Alert><button className="secondary" onClick={()=>{setError('');setRetry(v=>v+1);}}>Reintentar ficha</button></>:!c?<Loading label="Cargando comunidad…"/>:<ChurchPresentation c={c}/>}</div>;
}
