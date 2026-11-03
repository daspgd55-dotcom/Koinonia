import React,{useState} from 'react';
export const statuses={received:'Recibida',pending_email:'Pendiente de confirmar correo',pending_review:'Pendiente de revisión administrativa',contacted:'Contactada',approved:'Aprobada',rejected:'Rechazada',duplicate:'Duplicada',closed:'Cerrada'};
export const invitationLabels={not_sent:'Sin invitación',ready:'Lista para invitar',pending:'Pendiente de aceptación',accepted:'Aceptada',declined:'Rechazada',revoked:'Revocada'};
export const privacyLabels={withdraw:'Retirada',no_contact:'No contacto',delete:'Eliminación de datos'};
export const functions={administrator:'Administración de iglesia',editor:'Eventos y comunidades',moderator:'Moderación',welcome:'Bienvenida y visitas'};
export function useRegistrationAction(){const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');async function run(fn){setBusy(true);setError('');setMessage('');try{await fn();}catch(e){const fields=e.details?.filter?.(d=>d.path)?.map(d=>d.path+': '+d.message).join(' · ');setError(fields||e.message);}finally{setBusy(false);}}return {busy,error,message,setMessage,run};}
export function Feedback({action}){return <>{action.error&&<p className="notice error" role="alert">{action.error}</p>}{action.message&&<p className="notice" role="status">{action.message}</p>}</>;}
