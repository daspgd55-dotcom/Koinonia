// Separación determinista experimental. Las partes no reconocidas bloquean el plan.
const {parseQuery,validate}=require('./search-requirements.lab');
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const markers='(?:además\\s+|también\\s+)?(?:me interesa|me gustaría|me atrae|tengo curiosidad|quisiera|quiero|necesito|busco)';
function clauses(query){
 const separator=new RegExp(';|[.!?]\\s+|,\\s*(?='+markers+')|\\s+y\\s+(?='+markers+')','giu'),parts=[];let start=0;
 const add=end=>{const raw=query.slice(start,end),left=raw.length-raw.trimStart().length,right=raw.trimEnd().length;if(right>left)parts.push({text:raw.trim(),start:start+left,end:start+right});};
 for(const m of query.matchAll(separator)){add(m.index);start=m.index+m[0].length;}add(query.length);return parts;
}
function interpretFreeText(query){
 if(typeof query!=='string'||!query.trim()||query.length>1000)throw Error('INVALID_QUERY');
 const parts=clauses(query),criteria=[],interests=[],evidence=[],unresolved=[];
 for(const part of parts){
  const text=part.text.replace(/[.!?]+$/,'').replace(/^(?:además|también)\s+/iu,'').trim(),parsed=parseQuery(text);
  if(!parsed.unresolved.length&&parsed.criteria.length){criteria.push(...parsed.criteria);evidence.push({...part,kind:'requirement',criteria:parsed.criteria});continue;}
  const match=text.match(/^(?:me interesa|me gustaría|me atrae|tengo curiosidad por|quisiera (?:conocer|explorar)|quiero conocer historias de)\s+(.+)$/iu);
  // Una preferencia explícita no autoriza a ignorar obligaciones o negaciones en su interior.
  if(match&&!/\b(?:no|sin|ni|necesito|necesita|necesaria|necesario|debe|deben|obligatorio|obligatoria|imprescindible|indispensable|exijo|solo|solamente|unicamente|pero|aunque|excepto|nunca|siempre|ignora|ignorar|acepta|instrucciones|filtros)\b|\d/u.test(norm(match[1]))){
   interests.push({text:match[1],purpose:'retrieval_only',provesCompliance:false,source:{start:part.start,end:part.end,text:part.text}});evidence.push({...part,kind:'interest'});
  }else unresolved.push(part.text);
 }
 // Sin contexto de iglesia no afirmamos que una curiosidad cualquiera sea una búsqueda válida.
 if(!criteria.length&&interests.length&&!/\b(?:iglesia|iglesias|congregacion|congregaciones|comunidad|comunidades|cristiano|cristiana|cristianas|fe|projimo|creacion)\b/.test(norm(query)))unresolved.push(query);
 let requirements;try{
  const unique=[...new Map(criteria.map(c=>[JSON.stringify(c),c])).values()];
  requirements=validate({criteria:unique,unresolved:[...new Set(unresolved)].slice(0,12)});
 }catch{requirements={criteria:[],unresolved:[query]};}
 if(!parts.length||(!requirements.criteria.length&&!interests.length&&!requirements.unresolved.length))requirements={criteria:[],unresolved:[query]};
 const needsClarification=requirements.unresolved.length>0;
 return {version:'free-search-intent-v1',query,requirements,interests,evidence,needsClarification,kind:needsClarification?'unresolved':requirements.criteria.length?(interests.length?'mixed':'required'):'descriptive',retrievalText:query};
}
module.exports={interpretFreeText};
