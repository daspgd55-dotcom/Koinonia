import React,{useEffect,useState} from 'react';

const tips={
  0:['Tu primera edición','Completa la ficha por secciones y guarda tus cambios. La vista previa permite revisar cómo se verá. Si aún no se ha publicado, solicita su publicación al terminar.'],
  2:['Rama, denominación y red','La rama es la tradición general; la denominación es más específica. Por ejemplo: Protestante → Bautista. En red, indica la asociación a la que pertenece la iglesia, si corresponde.'],
  3:['Creencias sin adivinar','Usa la declaración oficial de tu comunidad. Soteriología se refiere a la salvación; escatología, a los acontecimientos finales. Si no conoces una postura, déjala vacía. “Ocultar del perfil público” evita mostrar ese dato.'],
  4:['Tipos de reunión y horarios','Marca los tipos de reuniones que existen, aunque no tengas todos sus horarios. Luego añade los que conozcas: por ejemplo, Culto · Domingo · 11:00. No es necesario registrar cada célula para indicar que hay grupos pequeños.'],
  5:['Así se vive la comunidad','Puedes elegir varios estilos musicales y las actividades que realmente ofrecen. Por ejemplo: Himnodia Clásica y Góspel; campamentos y ayuda social. Las casillas de privacidad controlan si los estilos se muestran públicamente.'],
  6:['Personas y canales de contacto','Escribe el nombre y cargo de cada líder: por ejemplo, Ana Pérez · Líder de jóvenes. Guarda antes de asociarle una foto en multimedia. Estos datos de presentación no crean cuentas ni conceden permisos de administración.'],
  8:['Cada foto tiene su lugar','Elige la categoría antes de subir: instalaciones, reuniones, actividades, representantes o banner. Para un retrato, selecciona un líder ya guardado y ajusta el recorte. Puedes subir hasta 7 fotos. En fuente, indica de dónde viene la información, por ejemplo: Secretaría de la iglesia.']
};
const fallback=new Map(),keyFor=id=>'koinonia-representative-help-v1-'+id;
function read(key){try{return JSON.parse(localStorage.getItem(key))||fallback.get(key)||{};}catch{return fallback.get(key)||{};}}
function remember(key,section,skip=false){const current=read(key),next={...current,seen:{...current.seen,[section]:true},disabled:skip||current.disabled||false};fallback.set(key,next);try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Se recuerda durante esta visita si el navegador bloquea el almacenamiento. */}}

export default function RepresentativeHelp({userId,section}){
 const key=keyFor(userId),tip=tips[section],[open,setOpen]=useState(()=>!!tip&&!read(key).disabled&&!read(key).seen?.[section]),[paused,setPaused]=useState(false),[hovered,setHovered]=useState(false),[pinned,setPinned]=useState(false),[hidden,setHidden]=useState(document.hidden);
 useEffect(()=>{if(open)remember(key,section);},[key,section,open]);
 useEffect(()=>{const visibility=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
 useEffect(()=>{if(!open||paused||hovered||pinned||hidden)return;const timer=setTimeout(()=>setOpen(false),25000);return()=>clearTimeout(timer);},[open,paused,hovered,pinned,hidden]);
 if(!open||!tip)return null;
 return <aside className="representative-help" aria-label="Ayuda de primera visita" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false);}}><div className="help-copy" role="status"><strong>{tip[0]}</strong><p>{tip[1]}</p></div><div className="help-actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Entendido</button><button type="button" className="text-button" aria-pressed={pinned} onClick={()=>setPinned(v=>!v)}>{pinned?'Cerrar automáticamente':'Mantener visible'}</button><button type="button" className="text-button" onClick={()=>{remember(key,section,true);setOpen(false);}}>No mostrar más ayudas</button></div></aside>;
}
