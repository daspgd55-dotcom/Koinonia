import React,{useEffect,useId,useRef,useState} from 'react';
import './ManualDownload.css';
const manuals={administrator:['Administrador','administrador'],editor:['Editor','editor'],moderator:['Moderador','moderador'],welcome:['Bienvenida','bienvenida']};
export function manualRole(permissions=[]){return permissions.includes('church')?'administrator':permissions.includes('moderation')?'moderator':permissions.includes('content')?'editor':permissions.includes('visits')?'welcome':null;}
const href=key=>`${import.meta.env.BASE_URL}manuales/koinonia-manual-representante-${manuals[key][1]}.pdf`;
export default function ManualDownload({role}){
 const [open,setOpen]=useState(false),root=useRef(null),toggle=useRef(null),id=useId();
 useEffect(()=>{setOpen(false);},[role]);
 useEffect(()=>{if(!open)return;const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);},escape=e=>{if(e.key==='Escape'){setOpen(false);toggle.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 if(!manuals[role])return null;
 return <div className="manual-download-bar"><div ref={root} className="manual-download" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}><a className="secondary" href={href(role)} download>Descargar Manual {manuals[role][0]}</a>{role==='administrator'&&<><button ref={toggle} type="button" className="secondary manual-download-toggle" aria-label="Elegir otro manual" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}>▾</button>{open&&<div id={id} className="manual-download-options" aria-label="Manuales disponibles">{Object.entries(manuals).filter(([key])=>key!==role).map(([key,[label]])=><a key={key} href={href(key)} download onClick={()=>setOpen(false)}>Descargar Manual {label}</a>)}</div>}</>}</div></div>;
}
