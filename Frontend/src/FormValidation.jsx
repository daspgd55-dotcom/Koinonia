import {useEffect} from 'react';
export default function FormValidation(){
 useEffect(()=>{let frame;
  function invalid(e){const field=e.target;if(!field.closest('main'))return;for(let node=field.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
   if(frame)return;frame=requestAnimationFrame(()=>{frame=null;if(!field.isConnected)return;field.focus({preventScroll:true});field.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
  }
  document.addEventListener('invalid',invalid,true);return()=>{document.removeEventListener('invalid',invalid,true);if(frame)cancelAnimationFrame(frame);};
 },[]);return null;
}
