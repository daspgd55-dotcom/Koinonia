import {useEffect,useState} from 'react';
import {api} from './api';
export function useUnread(token){
 const [count,setCount]=useState(0);
 useEffect(()=>{setCount(0);if(!token)return;let alive=true;const load=()=>{if(document.hidden)return;api('/notifications?limit=1',{token}).then(r=>{if(alive)setCount(r.unread);}).catch(()=>{});};load();const timer=setInterval(load,15000);window.addEventListener('visits-changed',load);window.addEventListener('focus',load);document.addEventListener('visibilitychange',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('visits-changed',load);window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',load);};},[token]);
 return count;
}
