import Loading from './Loading';
import React,{useEffect,useState} from 'react';
import {api} from './api';
export default function UsernameField(){
 const [value,setValue]=useState(''),[result,setResult]=useState(null);
 useEffect(()=>{let alive=true;setResult(null);if(!/^[a-z][a-z0-9_]{2,23}$/.test(value))return;const timer=setTimeout(()=>api('/usernames/availability?username='+encodeURIComponent(value)).then(r=>{if(alive)setResult(r.data.available?'Disponible':'Ese nombre ya está en uso.');}).catch(e=>{if(alive)setResult(e.message);}),500);return()=>{alive=false;clearTimeout(timer);};},[value]);
 return <label>Nombre de usuario<input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[a-z][a-z0-9_]{2,23}" value={value} onChange={e=>setValue(e.target.value.toLowerCase())} aria-describedby="username-hint username-status"/><small id="username-hint">De 3 a 24 caracteres. Empieza por una letra; usa letras, números o guion bajo. Tus amigos podrán encontrarte con este nombre.</small><small id="username-status" role="status">{result||(value.length>=3?(/^[a-z][a-z0-9_]{2,23}$/.test(value)?<Loading inline label="Comprobando nombre…"/>:'Usa letras, números y guion bajo; empieza por una letra.'):'')}</small></label>;
}
