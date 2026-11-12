import React,{useEffect,useState} from 'react';
const build=typeof __APP_BUILD__==='string'?__APP_BUILD__:null;
export default function VersionNotice(){
 const [changed,setChanged]=useState(false);
 useEffect(()=>{if(!build)return;let alive=true,checking=false;async function check(){if(checking||document.hidden)return;checking=true;try{const r=await fetch('/version.json?t='+Date.now(),{cache:'no-store'});if(r.ok){const v=await r.json();if(alive&&typeof v.buildId==='string')setChanged(v.buildId!==build);}}catch{}finally{checking=false;}}check();window.addEventListener('focus',check);const timer=setInterval(check,60000);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',check);};},[]);
 if(!changed)return null;
 return <aside className="version-notice" aria-label="Actualización disponible" style={{padding:'12px 24px',fontSize:13}}><div role="status">Hay una versión nueva. Guarda tus cambios antes de actualizar. <button type="button" onClick={()=>location.reload()}>Actualizar aplicación</button></div></aside>;
}
