import React,{useState} from 'react';
import {frames} from './mediaFrames';

function playerUrl(url){
  const host=url.hostname, path=url.pathname;
  if(['drive.google.com','docs.google.com'].includes(host)){
    const id=path.match(/^\/file\/(?:u\/\d+\/)?d\/([\w-]+)(?:\/|$)/)?.[1] || url.searchParams.get('id');
    if(!id||!/^[-\w]+$/.test(id))return null;
    const player=new URL('https://drive.google.com/file/d/'+id+'/preview');
    if(url.searchParams.has('resourcekey'))player.searchParams.set('resourcekey',url.searchParams.get('resourcekey'));
    return player.href;
  }
  let id;
  if(host==='youtu.be')id=path.split('/')[1];
  if(['www.youtube.com','youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host))
    id=path==='/watch'?url.searchParams.get('v'):path.match(/^\/(?:embed|live|shorts)\/([^/]+)\/?$/)?.[1];
  return id&&/^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:null;
}

export default function ResourceVideo({media}){
  const [failed,setFailed]=useState(null);
  let url;
  try{url=new URL(media.url);}catch{return null;}
  if(!['https:','http:'].includes(url.protocol))return null;
  const src=playerUrl(url),title=media.title||'Video de la comunidad';
  const style={display:'block',width:'100%',aspectRatio:frames[media.frame]?.ratio||16/9,border:0};
  return <div>{src?<iframe src={src} title={title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={style}/>:failed!==url.href?<video onError={()=>setFailed(url.href)} controls playsInline preload="none" src={url.href} aria-label={title} style={style}/>:<p>Este enlace no se puede reproducir aquí. Puedes abrirlo en su sitio de origen.</p>}
    <a href={url.href} target="_blank" rel="noopener noreferrer">{media.title||'Abrir video'} â†—</a></div>;
}
