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
  const candidates=churches.filter(c=>name(c.identification?.name)===name(row.name)).map(c=>({id:String(c._id),name:c.identification.name,location:c.location,active:c.active,testData:!!c.metadata?.testData,merged:!!c.mergedInto,comparison:compare(row,c),fingerprint:digest(c)}));
  const recipients=emails(row.email),invalidEmails=recipients.filter(e=>!require('../validation/schemas').z.string().email().safeParse(e).success);
  const candidate=candidates.length===1?candidates[0]:null,key=candidate?candidate.id+'|'+recipients.slice().sort().join(';'):null,duplicate=key&&seen.has(key);if(key)seen.add(key);
  const status=!row.name.trim()?'missing_name':!candidates.length?'not_found':candidates.length>1?'ambiguous':candidate.merged?'merged':duplicate?'duplicate':'matched';
  return {...row,recipients,invalidEmails,status,candidates,churchId:status==='matched'?candidate.id:null};
 });
}
async function preview(input,session=null){
 // Exact normalized names, never fuzzy assignment; projected fields only, no secrets.
 const churches=await Church.find({}).select('identification.name contact location.address location.commune active metadata.testData mergedInto updatedAt __v').sort({_id:1}).session(session).lean();
 const rows=matchRows(input.rows,churches);return {source:input.source,rows,digest:digest({source:input.source,rows})};
}
async function confirm(input,actor){
 if(actor?.role!=='admin')throw new HttpError(403,'FORBIDDEN','Se requiere administración global');
 const requestHash=digest(input),prior=await Batch.findOne({requestHash});if(prior)return prior;
 const plan=await preview({source:input.source,rows:input.rows});if(plan.digest!==input.digest)throw new HttpError(409,'IMPORT_CHANGED','Las fichas cambiaron. Vuelve a analizar las asociaciones.');
 const selected=plan.rows.filter(r=>input.selectedRows.includes(r.row));if(selected.length!==input.selectedRows.length||selected.some(r=>r.status!=='matched'))throw new HttpError(400,'IMPORT_SELECTION','Selecciona únicamente filas con una coincidencia única.');
 try{return await Batch.create({requestHash,source:input.source,createdBy:actor._id,associations:selected.map(r=>({sourceRow:r.row,church:r.churchId,name:r.name,contacts:Object.fromEntries(['email','phone','website','facebook','instagram','youtube'].map(k=>[k,r[k]||''])),recipients:r.recipients,invalidEmails:r.invalidEmails,comparison:r.candidates[0].comparison,testData:r.candidates[0].testData})),previewDigest:plan.digest});}catch(e){if(e.code===11000)return Batch.findOne({requestHash});throw e;}
}
async function resolve(input,actor){
 if(actor?.role!=='admin')throw new HttpError(403,'FORBIDDEN','Se requiere administración global');
 const requestHash=digest({resolution:input});
 const prior=await Batch.findOne({requestHash});if(prior)return prior;
 try{return await Church.db.transaction(async session=>{
  const existing=await Batch.findOne({requestHash}).session(session);if(existing)return existing;
  const plan=await preview({source:input.source,rows:[input.row]},session),candidate=plan.rows[0].candidates.find(c=>c.id===input.churchId);
  let church;
  if(input.mode==='update'){
   if(!candidate||candidate.merged||candidate.fingerprint!==input.fingerprint)throw new HttpError(409,'IMPORT_CHANGED','La ficha cambió o no corresponde a los candidatos. Analiza otra vez.');
   church=await Church.findById(input.churchId).session(session);
  }else{
   if(plan.digest!==input.digest)throw new HttpError(409,'IMPORT_CHANGED','Cambió la comparación. Analiza otra vez antes de crear.');
   church=new Church({identification:{name:input.row.name},location:{commune:input.row.commune,coordinates:{type:'Point',coordinates:[input.longitude,input.latitude]}},createdBy:actor._id,metadata:{dataStatus:'draft'},active:false});
  }
  const before=church.isNew?null:{contact:church.toObject().contact,location:church.toObject().location};
  for(const key of input.fields){const value=input.row[key];if(!value?.trim())continue;const path=['commune','address'].includes(key)?'location.':'contact.';church.set(path+key,value);}
  church.updatedBy=actor._id;church.metadata.version=(church.metadata.version||0)+1;await church.save({session});
  const r=plan.rows[0];const [batch]=await Batch.create([{requestHash,source:input.source,previewDigest:plan.digest,createdBy:actor._id,resolution:{mode:input.mode,before,fields:input.fields},associations:[{sourceRow:r.row,church:church._id,name:church.identification.name,contacts:Object.fromEntries(['email','phone','website','facebook','instagram','youtube'].map(k=>[k,r[k]||''])),recipients:r.recipients,invalidEmails:r.invalidEmails,comparison:candidate?.comparison||[],testData:!!church.metadata.testData}]}],{session});return batch;
 });}catch(e){if(e.code===11000){const prior=await Batch.findOne({requestHash});if(prior)return prior;}throw e;}
}
module.exports={preview,confirm,resolve,matchRows,normalize};
