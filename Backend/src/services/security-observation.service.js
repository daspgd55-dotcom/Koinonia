// Future detectors call this server-only boundary. No detector or new rejection is enabled here.
function observeDecision(policy,control,decision,record=entry=>console.info(JSON.stringify(entry))){
 if(!['captchaMode','advancedAbuseMode'].includes(control))throw Error('Control de observación desconocido');
 if(!['off','observe'].includes(policy[control]))throw Error('Modo de observación inválido');
 if(policy[control]==='off')return {blocked:false,recorded:false};
 if(typeof decision?.wouldBlock!=='boolean')throw Error('Decisión inválida');
 const entry={event:'security_observation',control,wouldBlock:decision.wouldBlock};
 // Deliberately excludes request, identifiers, arbitrary reasons, tokens and provider credentials.
 try{record(entry);return {blocked:false,recorded:true};}catch{return {blocked:false,recorded:false};}
}
module.exports={observeDecision};
