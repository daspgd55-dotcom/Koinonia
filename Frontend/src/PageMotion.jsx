import React,{useEffect,useRef} from 'react';
const targets='.home>section,.home .landscape,.home-bottom,.church-card,.discovery-card,.profile-block,.profile-preferences,.saved-card,.manage-list article,.manage-editor,.auth-card,.question-card,.detail-section,.detail-fold,.detail-banner,.experience-card';
export default function PageMotion({route,children}){
 const root=useRef(null);
 useEffect(()=>{
  const node=root.current,media=window.matchMedia('(prefers-reduced-motion: reduce)'),seen=new WeakSet(),animations=new Set();let observed=new WeakSet(),observer,mutations,frame;
  function animate(el,keyframes,duration){if(media.matches||!el.animate)return;const a=el.animate(keyframes,{duration,easing:'cubic-bezier(.2,.7,.2,1)'});animations.add(a);a.onfinish=a.oncancel=()=>animations.delete(a);}
  function scan(){frame=null;if(!observer)return;node.querySelectorAll(targets).forEach(el=>{if(!observed.has(el)){observed.add(el);observer.observe(el);}});}
  function stop(){observer?.disconnect();mutations?.disconnect();if(frame)cancelAnimationFrame(frame);animations.forEach(a=>a.cancel());animations.clear();}
  function start(){stop();observed=new WeakSet();if(media.matches)return;animate(node,[{opacity:.7},{opacity:1}],180);if(!window.IntersectionObserver)return;
   observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(!isIntersecting||seen.has(target))return;seen.add(target);observer.unobserve(target);animate(target,[{opacity:.45},{opacity:1}],320);}),{threshold:0,rootMargin:'0px 0px -24px 0px'});
   scan();mutations=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(scan);});mutations.observe(node,{childList:true,subtree:true});
  }
  function focus(e){animations.forEach(a=>{if(a.effect?.target?.contains(e.target))a.finish();});}
  start();media.addEventListener('change',start);node.addEventListener('focusin',focus);
  return()=>{stop();media.removeEventListener('change',start);node.removeEventListener('focusin',focus);};
 },[route]);
 return <div ref={root} className="page-motion">{children}</div>;
}
