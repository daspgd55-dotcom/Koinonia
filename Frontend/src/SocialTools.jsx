import {openChat} from './chatActions';
import React,{useContext,useEffect,useRef,useState} from 'react';
import {SessionContext} from './Membership';
import {api} from './api';
import './Friends.css';
const notify=()=>window.dispatchEvent(new Event('social-changed'));
const title=u=>u.username?'@'+u.username:u.name;
export function SocialNav({onClick}){return <a href="#/amigos" onClick={onClick}>Amigos</a>;}
export function FriendShare({resource}){
 const {token,user}=useContext(SessionContext),[open,setOpen]=useState(false),[rows,setRows]=useState(null),[page,setPage]=useState(1),[selected,setSelected]=useState(''),[text,setText]=useState(''),[error,setError]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),attempt=useRef(null);
 useEffect(()=>{if(!open||!token)return;let alive=true;setRows(null);setError('');api('/friends?view=friends&page='+page,{token}).then(r=>{if(alive)setRows(r);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[open,token,page]);
 async function send(e){e.preventDefault();setBusy(true);setError('');const payload=JSON.stringify({selected,text,resource});if(attempt.current?.payload!==payload)attempt.current={payload,id:crypto.randomUUID()};try{await api('/friends/'+selected+'/messages',{token,method:'POST',body:{clientId:attempt.current.id,text,resource}});setSent(true);attempt.current=null;notify();}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!user)return null;
 return <div className="friend-share"><button className="text-button" aria-expanded={open} onClick={()=>{setOpen(!open);setSent(false);}}>Enviar a un amigo</button>{open&&<section className="friend-share-panel" aria-label="Compartir con un amigo">{sent?<p role="status">Publicación enviada. <button className="text-button" onClick={()=>openChat(selected)}>Ver conversación</button></p>:<form onSubmit={send}><label>Amigo<select aria-label="Amigo destinatario" required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecciona un amigo</option>{rows?.data.map(f=><option key={f.id} value={f.id}>{title(f.user)}</option>)}</select></label>{!rows&&!error&&<p role="status">Cargando amigos…</p>}{rows&&!rows.data.length&&<p>Aún no tienes amigos en esta lista. <a href="#/amigos">Buscar amigos</a></p>}<div className="social-actions"><button type="button" className="text-button" disabled={page===1} onClick={()=>{setPage(p=>p-1);setSelected('');}}>Anterior</button><button type="button" className="text-button" disabled={!rows?.hasMore} onClick={()=>{setPage(p=>p+1);setSelected('');}}>Más amigos</button></div><label>Mensaje opcional<textarea maxLength={2000} value={text} onChange={e=>setText(e.target.value)}/></label><button disabled={busy||!selected}>{busy?'Enviando…':'Enviar publicación'}</button></form>}{error&&<p role="alert">{error}</p>}<button className="text-button" onClick={()=>setOpen(false)}>Cerrar</button></section>}</div>;
}
