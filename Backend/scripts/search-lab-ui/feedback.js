// Formato compartido por el navegador y las comprobaciones locales. Nunca ejecuta contenido importado.
(function(root){
 const schema='koinonia-search-lab-feedback-v1',limit=500,maxBytes=10*1024*1024;
 function parse(text){
  if(new TextEncoder().encode(text).length>maxBytes)throw Error('El archivo supera 10 MB.');
  let data;try{data=JSON.parse(text);}catch{throw Error('El archivo no contiene JSON válido.');}
  if(data?.schema!==schema||!Array.isArray(data.records)||data.records.length>limit)throw Error('Formato no compatible o más de 500 evaluaciones.');
  const keys=new Set();for(const r of data.records){
   if(!r||typeof r.key!=='string'||!r.key||r.key.length>2000||keys.has(r.key)||r.schemaVersion!==1||typeof r.query!=='string'||!r.query.trim()||r.query.length>1000||!['full','interest'].includes(r.mode)||!['result','interpretation'].includes(r.kind)||![null,'useful','insufficient','irrelevant'].includes(r.rating)||typeof r.comment!=='string'||r.comment.length>1000||!r.intent||!Array.isArray(r.intent.requirements?.criteria)||!Array.isArray(r.intent.interests)||typeof r.updatedAt!=='string')throw Error('Hay evaluaciones incompletas, incompatibles o claves duplicadas. No se importó ninguna.');
   keys.add(r.key);
  }return data.records;
 }
 function merge(existing,rows){const merged=new Map(existing);let added=0,skipped=0;for(const r of rows){if(merged.has(r.key)){skipped++;continue;}merged.set(r.key,r);added++;}if(merged.size>limit)throw Error('La combinación supera 500 evaluaciones. Exporta las actuales antes de liberar espacio.');return {merged,added,skipped};}
 function serialize(records){return JSON.stringify({schema,exportedAt:new Date().toISOString(),note:'Evaluaciones manuales; no constituyen verificación institucional.',records:[...records]},null,2);}
 const api={parse,merge,serialize,maxBytes};if(typeof module==='object')module.exports=api;else root.LabFeedback=api;
})(typeof globalThis==='object'?globalThis:this);
