import React from 'react';
import {frames} from './mediaFrames';

function playerUrl(url){
  const host=url.hostname, path=url.pathname;
  if(host==='drive.google.com'){
    const id=path.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1] || (path==='/open' && url.searchParams.get('id'));
    if(!id||!/^[-\w]+$/.test(id))return null;
    const player=new URL('https://drive.google.com/file/d/'+id+'/preview');
    if(url.searchParams.has('resourcekey'))player.searchParams.set('resourcekey',url.searchParams.get('resourcekey'));
    return player.href;
  }
  let id;
  if(host==='youtu.be')id=path.slice(1);
  if(['www.youtube.com','youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host))
    id=path==='/watch'?url.searchParams.get('v'):path.match(/^\/(?:embed|live|shorts)\/([^/]+)\/?$/)?.[1];
  return id&&/^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:null;
}

export default function ResourceVideo({media}){
  let url;
  try{url=new URL(media.url);}catch{return null;}
  if(!['https:','http:'].includes(url.protocol))return null;
  const src=playerUrl(url),title=media.title||'Video de la comunidad';
  const style={display:'block',width:'100%',aspectRatio:frames[media.frame]?.ratio||16/9,border:0};
  return <div>{src?<iframe src={src} title={title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={style}/>: /\.(mp4|webm|ogv)$/i.test(url.pathname)?<video controls playsInline preload="none" src={url.href} aria-label={title} style={style}/>:null}
    <a href={url.href} target="_blank" rel="noopener noreferrer">{media.title||'Abrir video'} ↗</a></div>;
}
