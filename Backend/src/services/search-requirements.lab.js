// Contrato experimental: evidencia estructurada pública, nunca similitud como prueba.
const {z}=require('zod');
const {publicChurch}=require('./church.service');
const {eligible}=require('./church-embedding-document.lab');
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const sets=['community.activities','community.ministries','community.targetGroups','doctrine.characteristics'];
const flags=['location.accessibilityDetails.ramp','location.accessibilityDetails.accessibleRestroom','location.accessibilityDetails.elevator','location.accessibilityDetails.signLanguage'];
const fields=[...sets,...flags,'location.commune'];
const textValue=z.string().trim().min(1).max(200);
const criterion=z.strictObject({field:z.enum(fields),value:z.union([textValue,z.array(textValue).min(2).max(6)]),polarity:z.enum(['include','exclude'])});
const contract=z.strictObject({criteria:z.array(criterion).max(12),unresolved:z.array(z.string().min(1).max(1000)).max(12)});
function validate(input){
 const result=contract.parse(input),seen=new Set();
 for(const c of result.criteria){if(Array.isArray(c.value)&&(c.field!=='location.commune'||c.polarity!=='include'))throw Error('INVALID_ALTERNATIVES');if(flags.includes(c.field)&&c.value!=='yes')throw Error('INVALID_BOOLEAN_REQUIREMENT');for(const value of Array.isArray(c.value)?c.value:[c.value]){const key=c.field+':'+norm(value);if(seen.has(key))throw Error('DUPLICATE_OR_CONTRADICTORY_REQUIREMENT');seen.add(key);}}
 return result;
}
// Interpretación completa o abstención; validación estructural independiente.
function parseQuery(query){return validate(require('./requirement-interpretation.lab').interpret(query));}
function evaluateChurch(raw,input){
 const request=validate(input),source=raw.toObject?raw.toObject():raw;
 if(!eligible(source))return {churchId:String(source._id),status:'ineligible',eligibleForResults:false,requirements:[]};
 const church=publicChurch(source),requirements=request.criteria.map(c=>{
  const value=c.field.split('.').reduce((o,k)=>o?.[k],church);let fact='unknown',reason='missing_evidence';
  if(sets.includes(c.field)){
   if(Array.isArray(value)&&value.some(v=>typeof v==='string'&&norm(v)===norm(c.value))){fact='present';reason='explicit_list_item';}
   // Listas no exhaustivas: ausencia de una etiqueta no acredita ausencia del servicio.
  }else if(flags.includes(c.field)){
   if(value==='yes'){fact='present';reason='explicit_yes';}else if(value==='no'){fact='absent';reason='explicit_no';}else if(value==='partial'){reason='partial_requires_clarification';}
  }else if(typeof value==='string'&&value.trim()) {fact=(Array.isArray(c.value)?c.value:[c.value]).some(v=>norm(value)===norm(v))?'present':'absent';reason=Array.isArray(c.value)?'explicit_any_of':'explicit_single_value';}
  const status=fact==='unknown'?'unknown':((fact==='present')===(c.polarity==='include')?'satisfied':'not_satisfied');
  return {...c,status,reason,evidence:fact==='unknown'?null:{field:c.field,value:sets.includes(c.field)?value.find(v=>typeof v==='string'&&norm(v)===norm(c.value)):value,updatedAt:source.updatedAt||null,churchVersion:source.metadata?.version??null}};
 });
 const status=request.unresolved.length?'needs_clarification':requirements.some(r=>r.status==='not_satisfied')?'not_satisfied':!requirements.length||requirements.some(r=>r.status==='unknown')?'unknown':'satisfied';
 return {churchId:String(source._id),status,eligibleForResults:status==='satisfied',requirements,unresolved:request.unresolved};
}
function filterCandidates(candidates,churches,request){
 validate(request);const byId=new Map(churches.map(c=>[String(c._id),c])),seen=new Set(),accepted=[],held=[];
 for(const candidate of candidates){const id=String(candidate.churchId);if(seen.has(id))continue;seen.add(id);const source=byId.get(id),validation=source?evaluateChurch(source,request):{churchId:id,status:'unknown',eligibleForResults:false,reason:'source_unavailable'};
  (validation.eligibleForResults?accepted:held).push({...candidate,validation});
 }
 return {accepted,held};
}
module.exports={validate,parseQuery,evaluateChurch,filterCandidates};
