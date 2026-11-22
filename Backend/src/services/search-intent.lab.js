// Dos canales explícitos. Nunca reclasifica una condición desconocida como interés.
const {z}=require('zod');
const {filterCandidates}=require('./search-requirements.lab');
const {eligible}=require('./church-embedding-document.lab');
const input=z.strictObject({requirementsText:z.string().trim().max(1000).default(''),interestText:z.string().trim().max(1000).default('')});
function buildIntent(value){
 const {requirementsText,interestText}=input.parse(value);if(!requirementsText&&!interestText)throw Error('EMPTY_SEARCH_INTENT');
 const parsed=requirementsText?require('./free-search-intent.lab').interpretFreeText(requirementsText):null,requirements=parsed?parsed.requirements:{criteria:[],unresolved:[]};
 // En el canal obligatorio, una frase de interés tampoco se descarta silenciosamente.
 if(parsed){if(parsed.interests.length)requirements.unresolved=[...new Set([...requirements.unresolved,...parsed.interests.map(i=>i.source.text)])];}
 return {version:'search-intent-v1',kind:requirements.unresolved.length?'unresolved':requirements.criteria.length?(interestText?'mixed':'required'):'descriptive',requirements,interests:interestText?[{text:interestText,purpose:'retrieval_only',provesCompliance:false}]:[],needsClarification:requirements.unresolved.length>0,retrievalText:[requirementsText,interestText].filter(Boolean).join('\n')};
}
// Recibe los canales de entrada y reconstruye el plan; no acepta un plan manipulado.
function assessCandidates(candidates,churches,input){
 const intent=buildIntent(input);
 return assessIntent(candidates,churches,intent);
}
function assessFreeTextCandidates(candidates,churches,query){
 return assessIntent(candidates,churches,require('./free-search-intent.lab').interpretFreeText(query));
}
// Solo recibe planes construidos internamente; no se exporta.
function assessIntent(candidates,churches,intent){
 if(intent.requirements.criteria.length||intent.needsClarification)return {intent,...filterCandidates(candidates,churches,intent.requirements)};
 const sources=new Map(churches.map(c=>[String(c._id),c])),seen=new Set(),accepted=[],held=[];
 for(const candidate of candidates){const id=String(candidate.churchId);if(seen.has(id))continue;seen.add(id);const source=sources.get(id),visible=source&&eligible(source);
  const row={...candidate,validation:{churchId:id,status:visible?'not_required':source?'ineligible':'unknown',eligibleForResults:!!visible,reason:visible?'descriptive_candidate_only':source?'not_discoverable':'source_unavailable'}};
  (visible?accepted:held).push(row);
 }
 return {intent,accepted,held};
}
module.exports={buildIntent,assessCandidates,assessFreeTextCandidates};
