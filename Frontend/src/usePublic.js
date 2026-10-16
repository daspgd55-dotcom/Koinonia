import {useEffect,useState} from 'react';
import {api} from './api';
export default function usePublic(path){
 const [state,setState]=useState({path,data:null,error:null}),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true,sequence=0;async function load(){const n=++sequence;setState({path,data:null,error:null});try{const data=await api(path);if(alive&&n===sequence)setState({path,data,error:null});}catch(error){if(alive&&n===sequence)setState({path,data:null,error});}}
 load();const focus=()=>{if(!document.hidden)load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{alive=false;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[path,retry]);
 return {...(state.path===path?state:{data:null,error:null}),retry:()=>setRetry(n=>n+1)};
}
