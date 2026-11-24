// Corroboración léxica conservadora: no certifica pertinencia ni usa umbral vectorial.
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const ignored=new Set(('a al algo alguna algunos ante como con de del desde donde el ella ellos en entre es esa ese esta este esto hacia hay la las lo los me mi mis muy o para por que se si sin sobre su sus te tu un una unas unos y iglesia iglesias comunidad comunidades congregacion congregaciones cristiana cristianas interesa interes gustaria busco necesito quiero conocer participar colaborar ofrezca tenga organice ensene encuentros actividades personas').split(' '));
function terms(text){return [...new Set((normalize(text).match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2&&!ignored.has(w)).map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w))];}
const concepts=[
 {id:'apoyo_social',label:'apoyo social',pattern:/\b(?:ayuda social|ayuda comunitaria|apoyo social|(?:apoyar|apoye|ayudar|ayude) a (?:los |las )?(?:vecinos|personas|familias)(?: necesitad[oa]s)?)\b/g},
 {id:'actividad_deportiva',label:'actividad deportiva',pattern:/\b(?:actividades deportivas|(?:practicar|hacer) deportes|deportes)\b/g}
];
function semantic(text){let normalized=normalize(text),aliases=[];for(const c of concepts)normalized=normalized.replace(c.pattern,match=>{aliases.push({concept:c.id,label:c.label,expression:match});return c.id.replaceAll('_','');});return {terms:terms(normalized),aliases};}
function checkInterest(interest,sources){
 const request=semantic(interest),required=request.terms;
 // Abstenerse frente a negaciones, hipótesis o temporalidad: no probar presencia por palabras aisladas.
 const uncertain=/\b(?:no|sin|nunca|antes|anteriormente|dejamos|dej[oó]|suspendid[oa]s?|cancelad[oa]s?|quiz[aá]s|ojal[aá]|planeamos|proyectamos|futuro)\b/iu;
 const matches=sources.map(s=>{const content=s.text.replace(/^[^:\n]+:\s*/,''),parts=content.split(/[.!?;\n]+/).filter(Boolean);return parts.map(part=>{const evidence=semantic(part),found=required.filter(t=>evidence.terms.includes(t));return {field:s.field,text:part.trim(),matched:found,aliases:evidence.aliases,supported:required.length>0&&!uncertain.test(interest)&&!uncertain.test(content)&&found.length===required.length};});}).flat();
 const supported=matches.filter(m=>m.supported),best=supported[0]||[...matches].sort((a,b)=>b.matched.length-a.matched.length)[0];
 return {interest,terms:required,matched:best?.matched||[],supported:!!supported.length,aliases:request.aliases,sources:supported.map(({field,text,aliases})=>({field,text,aliases})),reason:supported.length?'single_passage_support':'insufficient_or_ambiguous_evidence'};
}
function assessTopics(result,fragments){
 const interests=result.intent.interests;if(!interests.length)return {...result,exploratory:[],topicStatus:'not_requested'};
 const groups=new Map();for(const f of fragments){const id=String(f.churchId),body=f.text.split('\n').slice(1).join('\n');if(!groups.has(id))groups.set(id,[]);groups.get(id).push({field:f.source.field,text:body,terms:new Set(terms(body))});}
 const accepted=[],exploratory=[];
 for(const row of result.accepted){const sources=groups.get(String(row.churchId))||[],checks=interests.map(i=>checkInterest(i.text,sources));
  const supported=checks.every(c=>c.supported),item={...row,topicEvidence:{status:supported?'textual_support':'unconfirmed',checks,method:'controlled-concepts-v2'}};(supported?accepted:exploratory).push(item);
 }
 return {...result,accepted,exploratory,topicStatus:accepted.length?'textual_support':'insufficient_evidence'};
}
module.exports={assessTopics,terms,checkInterest};
