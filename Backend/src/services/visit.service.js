const {createHash}=require('node:crypto');
const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],offset=3*60*60*1000;
function nextOccurrence(day,time,now=new Date()){
 const weekday=days.indexOf(day);if(weekday<0||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const local=new Date(now.getTime()-offset),[h,m]=time.split(':').map(Number),delta=(weekday-local.getUTCDay()+7)%7;
 let date=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()+delta,h,m)+offset);
 if(date<=now)date=new Date(date.getTime()+7*86400000);return date;
}
function needsCoordination(note=''){
 const text=note.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return /\b(mensual(?:es)?|quincenal(?:es)?|bimestral(?:es)?|trimestral(?:es)?|anual(?:es)?|esporadic[ao]s?|ocasional(?:es)?)\b|\b(del|al|cada) mes\b|cada (dos|2|tres|3|cuatro|4) semanas|semana por medio|semanas alternas/.test(text);
}
function options(church,now=new Date()){
 const found=new Map();for(const meeting of church.meetings||[]){
 // Las notas informativas no invalidan horarios semanales. Frecuencias no semanales explícitas requieren coordinación.
 if(meeting.modality==='Online'||meeting.modality==='Virtual'||meeting.visitsEnabled===false||(meeting.frequency?meeting.frequency!=='weekly':needsCoordination(meeting.frequencyNotes)))continue;
 for(const schedule of meeting.schedule||[]){const startsAt=nextOccurrence(schedule.day,schedule.startTime,now);if(!startsAt)continue;
 const optionKey=createHash('sha256').update(JSON.stringify([meeting.type,schedule.day,schedule.startTime,meeting.modality||'',meeting.addressOrUrl||'',schedule.durationMinutes||120])).digest('hex');
 found.set(optionKey,{optionKey,meeting:meeting.type||'Reunión',day:schedule.day,time:schedule.startTime,address:meeting.addressOrUrl||church.location?.address||'',startsAt:startsAt.toISOString(),endsAt:new Date(startsAt.getTime()+(schedule.durationMinutes||120)*60000).toISOString(),timezone:'UTC-03:00',frequencyNotes:meeting.frequencyNotes||''});}}
 return [...found.values()].sort((a,b)=>a.meeting.localeCompare(b.meeting,'es')||a.day.localeCompare(b.day,'es')||a.time.localeCompare(b.time));
}
const state=(visit,now=new Date())=>visit.status==='cancelled'?'cancelled':new Date(visit.endsAt)<=now?'completed':visit.status;
module.exports={nextOccurrence,options,state};
