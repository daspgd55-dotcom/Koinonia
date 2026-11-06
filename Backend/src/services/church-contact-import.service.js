const {createHash}=require('node:crypto'),Church=require('../models/church.model'),Batch=require('../models/church-contact-import.model'),{HttpError}=require('../utils/errors');
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const name=v=>String(v||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const emails=v=>[...new Set(String(v||'').split(/[;,\s]+/).filter(Boolean).map(s=>s.toLowerCase()))];
function normalize(field,value){
 const v=String(value||'').trim();if(!v)return '';
 if(field==='email')return emails(v).sort().join(';');
 if(field==='phone'){const digits=v.replace(/\D/g,'');return digits.length===11&&digits.startsWith('56')?digits.slice(2):digits;}
 if(['website','facebook','instagram','youtube'].includes(field)){
  try{const u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v);if(!['http:','https:'].includes(u.protocol))return v;return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+([...u.searchParams].filter(([k])=>!/^utm_|^(fbclid|gclid)$/i.test(k)).length?u.search:'');}catch{return v;}
 }
 return name(v);
}
function compare(row,church){return ['email','phone','website','facebook','instagram','youtube','commune','address'].map(field=>{const incoming=row[field]||'',existing=(['commune','address'].includes(field)?church.location:church.contact)?.[field]||'';const a=normalize(field,incoming),b=normalize(field,existing),match=field==='email'?emails(incoming).some(e=>emails(existing).includes(e)):a===b;return {field,incoming,existing,state:!a?'not_provided':!b?'missing':match?'match':'different'};});}
function matchRows(rows,churches){
 const seen=new Set();return rows.map(row=>{
  const candidates=churches.filter(c=>name(c.identification?.name)===name(row.name)).map(c=>({id:String(c._id),name:c.identification.name,location:c.location,active:c.active,testData:!!c.metadata?.testData,merged:!!c.mergedInto,comparison:compare(row,c)}));
  const recipients=emails(row.email),invalidEmails=recipients.filter(e=>!require('../validation/schemas').z.string().email().safeParse(e).success);
  const candidate=candidates.length===1?candidates[0]:null,key=candidate?candidate.id+'|'+recipients.slice().sort().join(';'):null,duplicate=key&&seen.has(key);if(key)seen.add(key);
  const status=!row.name.trim()?'missing_name':!candidates.length?'not_found':candidates.length>1?'ambiguous':candidate.merged?'merged':duplicate?'duplicate':'matched';
  return {...row,recipients,invalidEmails,status,candidates,churchId:status==='matched'?candidate.id:null};
 });
}
async function preview(input){
 // Exact normalized names, never fuzzy assignment; projected fields only, no secrets.
 const churches=await Church.find({}).select('identification.name contact location.address location.commune active metadata.testData mergedInto').sort({_id:1}).lean();
 const rows=matchRows(input.rows,churches);return {source:input.source,rows,digest:digest({source:input.source,rows})};
}
async function confirm(input,actor){
 if(actor?.role!=='admin')throw new HttpError(403,'FORBIDDEN','Se requiere administración global');
 const requestHash=digest(input),prior=await Batch.findOne({requestHash});if(prior)return prior;
 const plan=await preview({source:input.source,rows:input.rows});if(plan.digest!==input.digest)throw new HttpError(409,'IMPORT_CHANGED','Las fichas cambiaron. Vuelve a analizar las asociaciones.');
 const selected=plan.rows.filter(r=>input.selectedRows.includes(r.row));if(selected.length!==input.selectedRows.length||selected.some(r=>r.status!=='matched'))throw new HttpError(400,'IMPORT_SELECTION','Selecciona únicamente filas con una coincidencia única.');
 try{return await Batch.create({requestHash,source:input.source,createdBy:actor._id,associations:selected.map(r=>({sourceRow:r.row,church:r.churchId,name:r.name,contacts:Object.fromEntries(['email','phone','website','facebook','instagram','youtube'].map(k=>[k,r[k]||''])),recipients:r.recipients,invalidEmails:r.invalidEmails,comparison:r.candidates[0].comparison,testData:r.candidates[0].testData})),previewDigest:plan.digest});}catch(e){if(e.code===11000)return Batch.findOne({requestHash});throw e;}
}
module.exports={preview,confirm,matchRows,normalize};
