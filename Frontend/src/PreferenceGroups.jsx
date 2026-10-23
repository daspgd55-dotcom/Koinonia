import React from 'react';
import {displayValue,asksDenomination} from './profile';
const groups=[
 [['Identidad y búsqueda',['spiritualIdentity','goal']],['Actividades y ministerios',['activities','ministries']],['Participación y bienvenida',['targetGroups','firstVisitPreference']]],
 [['Rama y denominación',['branches','denominations']],['Creencias y prácticas',['doctrinalTags']],['Idiomas',['languages']]],
 [['Punto de partida',['commune','address','location']],['Distancia y días',['radiusKm','meetingDays']]]
];
export default function PreferenceGroups({section,draft,renderQuestion}){return <div className="preference-groups">{groups[section].map(([title,keys],i)=>{const visible=keys.filter(k=>k!=='denominations'||asksDenomination(draft.values.branches)),answers=visible.filter(k=>draft.states[k]==='answered'||draft.states[k]==='no_preference').map(k=>displayValue(k,draft));return <details key={title} className="preference-group" open={i===0?true:undefined}><summary><strong>{title}</strong><span>{answers.length?answers.join(' · '):'Sin respuestas por ahora'}</span>{keys.some(k=>draft.dirty.includes(k))&&<small>Cambios sin guardar</small>}</summary><div className="question-card">{visible.map(renderQuestion)}</div></details>;})}</div>;}
