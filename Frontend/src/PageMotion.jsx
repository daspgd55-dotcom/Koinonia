import React,{useEffect,useRef} from 'react';
const cards='.church-card,.event-public-card,.saved-card,.linked-public-card,.experience-card,.visit-card,.manage-list article,.linked-grid>article';
const panels='.home>section,.home .landscape,.home-bottom,.discovery-card,.profile-block,.profile-preferences,.manage-editor,.user-editor,.auth-card,.question-card,.detail-section,.detail-fold,.detail-banner,.event-profile-hero,.events-intro,.event-search-panel,.discovery-description-search,.linked-public-heading,.linked-filters,.manage-filters,.saved-tools,.visit-request,.experience-form,.settings-heading,.settings-body,.preview-panel';
const targets=cards+','+panels+',main>section,main>form,.security-mail-page>section,[aria-label="Mantenimiento de seguridad"]';
export default function PageMotion({route,children}){
 const root=useRef(null);
 useEffect(()=>{
  const node=root.current,media=window.matchMedia('(prefers-reduced-motion: reduce)'),seen=new WeakSet(),animations=new Set(),observed=new Set();let observer,mutations,frame;
  function animate(el,keyframes,duration){if(media.matches||!el.animate)return;const a=el.animate(keyframes,{duration,easing:'cubic-bezier(.2,.7,.2,1)'});animations.add(a);a.onfinish=a.oncancel=()=>animations.delete(a);}
  function scan(){frame=null;if(!observer)return;observed.forEach(el=>{if(!node.contains(el)){observer.unobserve(el);observed.delete(el);}});node.querySelectorAll(targets).forEach(el=>{if(!seen.has(el)&&!observed.has(el)){observed.add(el);observer.observe(el);}});}
  function stop(){observer?.disconnect();mutations?.disconnect();if(frame)cancelAnimationFrame(frame);frame=null;animations.forEach(a=>a.cancel());animations.clear();observed.clear();}
  function start(){stop();if(media.matches)return;animate(node,[{opacity:.7},{opacity:1}],180);if(!window.IntersectionObserver)return;
   observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(!isIntersecting||seen.has(target)||target.closest('[hidden]'))return;seen.add(target);observer.unobserve(target);observed.delete(target);
    // Animate independent translate, so card hover transforms and image frames remain intact.
    const card=target.matches(cards);animate(target,card?[{opacity:0,translate:'0 24px'},{opacity:1,translate:'0 0'}]:[{opacity:.45},{opacity:1}],card?480:320);
   }),{threshold:0,rootMargin:'0px 0px -24px 0px'});
   scan();mutations=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(scan);});mutations.observe(node,{childList:true,subtree:true});
  }
  function focus(e){let el=e.target;while(el&&el!==node){if(el.matches?.(targets)){seen.add(el);observer?.unobserve(el);observed.delete(el);}el=el.parentElement;}animations.forEach(a=>{if(a.effect?.target?.contains(e.target))a.finish();});}
  function toggle(e){const el=e.target;if(el.tagName!=='DETAILS')return;const children=[...el.children].filter(c=>c.tagName!=='SUMMARY');animations.forEach(a=>{if(children.includes(a.effect?.target))a.cancel();});if(el.open)children.forEach(child=>animate(child,[{opacity:.35,translate:'0 -5px'},{opacity:1,translate:'0 0'}],220));}
  start();media.addEventListener('change',start);node.addEventListener('focusin',focus);node.addEventListener('toggle',toggle,true);
  return()=>{stop();media.removeEventListener('change',start);node.removeEventListener('focusin',focus);node.removeEventListener('toggle',toggle,true);};
 },[route]);
 return <div ref={root} className="page-motion">{children}</div>;
}
