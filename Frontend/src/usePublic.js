import {useEffect,useState} from 'react';
import {api} from './api';
export default function usePublic(path,token=''){
 const [state,setState]=useState({path,token,data:null,error:null}),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true,sequence=0;async function load(){const n=++sequence;setState({path,token,data:null,error:null});try{const data=await api(path,{token});if(alive&&n===sequence)setState({path,token,data,error:null});}catch(error){if(alive&&n===sequence)setState({path,token,data:null,error});}}
 load();const focus=()=>{if(!document.hidden)load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{alive=false;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[path,retry,token]);
 return {...(state.path===path&&state.token===token?state:{data:null,error:null}),retry:()=>setRetry(n=>n+1)};
}
