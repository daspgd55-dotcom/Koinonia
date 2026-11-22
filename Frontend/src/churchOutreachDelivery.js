import {api} from './api';
import {root} from './churchOutreachAdminConfig';
export async function sendApprovedMembers({id,token,members}){
  try{return await api(root+'/'+id+'/send-members',{token,method:'POST',body:{}});}
  catch(e){if(e.status!==404||e.message!=='Ruta no encontrada')throw e;}
  const selections=members.filter(m=>['prepared','pending'].includes(m.effectiveState)).map(m=>({invitation:id,kind:'member',email:m.email,reminder:false}));
  if(!selections.length)throw Error('No hay invitaciones individuales pendientes.');
  const batches='/church-outreach-mail-batches',post=(path,body,headers)=>api(batches+path,{token,method:'POST',body,headers});
  const preview=await post('/preview',{selections}),eligible=preview.items.filter(p=>p.eligible).map(p=>p.selection),excluded=preview.items.filter(p=>!p.eligible).map(p=>({email:p.email,reasons:p.reasons}));
  if(!eligible.length)return {processed:0,excluded};
  const {data}=await post('',{selections:eligible},{'Idempotency-Key':crypto.randomUUID()});
  await post('/'+data._id+'/enqueue',{confirm:true},{'If-Match':'"'+data.version+'"'});
  return {processed:eligible.length,excluded,queued:preview.capabilities.queueEnabled};
 }
