import {reportRecoverable} from './recoverableError';
import {pollingConfig} from './clientConfig';
import {useEffect,useState} from 'react';
import {api} from './api';
import {startPolling} from './polling';
export function useUnread(token){
 const [count,setCount]=useState(0);
 useEffect(()=>{setCount(0);if(!token)return;return startPolling(async({signal,isActive})=>{try{const r=await api('/notifications?limit=1',{token,background:true,signal});if(isActive())setCount(r.unread);}catch{if(isActive())reportRecoverable('notifications.refresh');}},{interval:pollingConfig.notifications,events:['visits-changed','social-changed']});},[token]);
 return count;
}
