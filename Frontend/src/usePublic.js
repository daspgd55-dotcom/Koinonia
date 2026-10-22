import {useEffect,useState} from 'react';
import {api} from './api';
export default function usePublic(path,token=''){
 const [state,setState]=useState({path,token,data:null,error:null}),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true,controller;async function load(){controller?.abort();const current=new AbortController();controller=current;setState(old=>old.path===path&&old.token===token?{...old,error:null}:{path,token,data:null,error:null});try{const data=await api(path,{token,signal:current.signal});if(alive&&!current.signal.aborted)setState({path,token,data,error:null});}catch(error){if(alive&&!current.signal.aborted)setState(old=>({...old,path,token,error}));}}
 load();const focus=()=>{if(!document.hidden)load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{alive=false;controller?.abort();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[path,retry,token]);
 return {...(state.path===path&&state.token===token?state:{data:null,error:null}),retry:()=>setRetry(n=>n+1)};
}
