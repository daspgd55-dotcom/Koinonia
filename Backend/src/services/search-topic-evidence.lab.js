// Corroboración léxica conservadora: no certifica pertinencia ni usa umbral vectorial.
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const ignored=new Set(('a al algo alguna algunos ante como con de del desde donde el ella ellos en entre es esa ese esta este esto hacia hay la las lo los me mi mis muy o para por que se si sin sobre su sus te tu un una unas unos y iglesia iglesias comunidad comunidades congregacion congregaciones cristiana cristianas interesa interes gustaria busco necesito quiero conocer participar colaborar ofrezca tenga organice ensene encuentros actividades personas').split(' '));
function terms(text){return [...new Set((normalize(text).match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2&&!ignored.has(w)).map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w))];}
function assessTopics(result,fragments){
 const interests=result.intent.interests;if(!interests.length)return {...result,exploratory:[],topicStatus:'not_requested'};
 const groups=new Map();for(const f of fragments){const id=String(f.churchId),body=f.text.split('\n').slice(1).join('\n');if(!groups.has(id))groups.set(id,[]);groups.get(id).push({field:f.source.field,text:body,terms:new Set(terms(body))});}
 const accepted=[],exploratory=[];
 for(const row of result.accepted){const sources=groups.get(String(row.churchId))||[],checks=interests.map(i=>{const required=terms(i.text),matches=required.filter(t=>sources.some(s=>s.terms.has(t)));return {interest:i.text,terms:required,matched:matches,supported:required.length>0&&matches.length===required.length,sources:sources.filter(s=>required.some(t=>s.terms.has(t))).map(({field,text})=>({field,text}))};});
  const supported=checks.every(c=>c.supported),item={...row,topicEvidence:{status:supported?'textual_support':'unconfirmed',checks,method:'lexical-all-terms-v1'}};(supported?accepted:exploratory).push(item);
 }
 return {...result,accepted,exploratory,topicStatus:accepted.length?'textual_support':'insufficient_evidence'};
}
module.exports={assessTopics,terms};
