import React,{useEffect,useState} from 'react';
const build=typeof __APP_BUILD__==='string'?__APP_BUILD__:null;
export default function VersionNotice(){
 useEffect(()=>{if(!build)return;let checking=false,reloadTimer=0;async function check(){if(checking||document.hidden)return;checking=true;try{const r=await fetch('/version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const v=await r.json();if(typeof v.buildId!=='string'||v.buildId===build)return;const editing=[...document.querySelectorAll('input,textarea,select,[contenteditable="true"]')].some(el=>{if(el.disabled||el.readOnly||el.getAttribute('aria-readonly')==='true')return false;if(el.type==='checkbox'||el.type==='radio'||el.tagName==='SELECT')return el.dataset.dirty==='true';return el.value!==el.defaultValue||el.isContentEditable;});if(!editing)location.reload();}catch{}finally{checking=false;}}check();window.addEventListener('focus',check);const timer=setInterval(check,30000);return()=>{clearInterval(timer);clearTimeout(reloadTimer);window.removeEventListener('focus',check);};},[]);
 return null;
}
