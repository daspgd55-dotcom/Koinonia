import React,{useEffect,useRef,useState} from 'react';
import {frameStyle} from './mediaFrames';
export const imagePosition=item=>({objectPosition:`${item?.focalX??50}% ${item?.focalY??50}%`});
export default function Photos({media=[],label='Fotos de la comunidad',onImageError}){
 const photos=media.filter(x=>x.type==='image'&&/^https?:\/\//i.test(x.url)),[index,setIndex]=useState(0),[paused,setPaused]=useState(false),[hover,setHover]=useState(false),[zoom,setZoom]=useState(1),[opened,setOpened]=useState(false),[reduced,setReduced]=useState(false),dialog=useRef(null),strip=useRef(null);
 const current=Math.min(index,Math.max(0,photos.length-1)),item=photos[current];
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update);},[]);
 useEffect(()=>{if(paused||hover||opened||reduced||photos.length<2)return;const timer=setInterval(()=>{if(!document.hidden)setIndex(i=>(i+1)%photos.length);},5000);return()=>clearInterval(timer);},[paused,hover,opened,reduced,photos.length]);
 useEffect(()=>{const el=strip.current?.children[current];if(el)strip.current.scrollTo({left:Math.max(0,el.offsetLeft-strip.current.offsetLeft-strip.current.clientWidth/2+el.clientWidth/2),behavior:reduced?'instant':'smooth'});},[current,reduced]);
 function select(i){setIndex((i+photos.length)%photos.length);setZoom(1);setPaused(true);}
 function open(){setOpened(true);setZoom(1);dialog.current.showModal();}
 if(!item)return null;
 return <section className="community-gallery" aria-label={label} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
 <button className="gallery-stage" style={frameStyle(item)} type="button" onClick={open} aria-label="Ampliar foto"><img key={item.url+current} className="community-cover" src={item.url} onError={onImageError} alt={item.title||'Foto de la comunidad'} style={{...imagePosition(item),...frameStyle(item),height:'auto'}}/>{item.category!=='representatives'&&item.frame!=='circle'&&<span className="gallery-enlarge">Ampliar +</span>}</button>
 {photos.length>1&&<div className="gallery-controls"><button type="button" className="secondary" disabled={photos.length<2} aria-label="Foto anterior" onClick={()=>select(current-1)}>←</button><span>{current+1} / {photos.length}{item.title?' · '+item.title:''}</span><button type="button" className="secondary" disabled={photos.length<2} aria-label="Foto siguiente" onClick={()=>select(current+1)}>→</button>{photos.length>1&&!reduced&&<button type="button" className="text-button" onClick={()=>setPaused(v=>!v)}>{paused?'Reanudar presentación':'Pausar presentación'}</button>}</div>}
 {photos.length>1&&<div ref={strip} className="gallery-thumbnails">{photos.map((p,i)=><button key={p.url+i} type="button" onClick={()=>select(i)} aria-label={'Ver foto '+(i+1)} aria-pressed={i===current}><img src={p.url} alt="" style={imagePosition(p)}/></button>)}</div>}
 <dialog ref={dialog} className="photo-dialog" aria-label="Foto ampliada" onClose={()=>{setOpened(false);setZoom(1);}} onClick={e=>{if(e.target===dialog.current)dialog.current.close();}} onKeyDown={e=>{if(e.target.tagName==='INPUT')return;if(e.key==='ArrowRight')select(current+1);if(e.key==='ArrowLeft')select(current-1);}}>
 <div className="gallery-controls"><button type="button" className="secondary" onClick={()=>select(current-1)} disabled={photos.length<2}>Anterior</button><span>{current+1} / {photos.length}</span><button type="button" className="secondary" onClick={()=>select(current+1)} disabled={photos.length<2}>Siguiente</button><button type="button" className="primary" autoFocus onClick={()=>dialog.current.close()}>Cerrar</button></div>
 <label>Zoom de foto<input type="range" min="1" max="4" step="0.1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><div className="photo-zoom-scroll"><img src={item.url} alt={item.title||'Foto ampliada de la comunidad'} style={{width:zoom*100+'%',maxWidth:'none'}}/></div><small>Amplía y desplázate por la imagen. Esc cierra la vista.</small>
 </dialog></section>;
}
