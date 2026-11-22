// Preparación experimental: sin conexión, escrituras ni integración con la búsqueda pública.
const {createHash}=require('node:crypto');
const {publicChurch,showcaseId}=require('./church.service');
const VERSION='church-public-text-v1';
const fields={
 'identification.description':'Sobre la iglesia','identification.distinctiveFeatures':'Características',
 'christianIdentity.branch':'Rama cristiana','christianIdentity.denomination':'Denominación','christianIdentity.associatedTradition':'Tradición','christianIdentity.network':'Red','christianIdentity.languages':'Idiomas',
 'doctrine.officialStatement':'Declaración doctrinal','doctrine.characteristics':'Doctrinas y prácticas','doctrine.soteriology':'Soteriología','doctrine.eschatology':'Escatología',
 'community.description':'Vida en comunidad','community.targetGroups':'Grupos','community.ministries':'Ministerios','community.activities':'Actividades','community.musicalStyles':'Estilos musicales','community.culturalStyle':'Estilo cultural',
 'location.commune':'Comuna','location.city':'Ciudad','location.region':'Región'
};
const digest=value=>createHash('sha256').update(value).digest('hex');
const clean=value=>typeof value==='string'?value.normalize('NFC').replace(/\s+/g,' ').trim():'';
function eligible(c){return c.active===true&&['published','verified'].includes(c.metadata?.dataStatus)&&!c.mergedInto&&String(c._id)!==String(showcaseId)&&c.importInfo?.batchId!=='showcase-senderos-2026-11-05';}
function prepareChurch(raw){
 const source=raw.toObject?raw.toObject():raw;if(!eligible(source))return [];
 const c=publicChurch(source),churchId=String(c._id),title=clean(c.identification?.name).slice(0,200);if(!title||!churchId||churchId==='undefined')throw Error('INVALID_CHURCH_IDENTITY');
 const context=['Iglesia: '+title,...['commune','city'].map(k=>clean(c.location?.[k])).filter(Boolean)].join(' · '),documents=[];
 for(const [field,label] of Object.entries(fields)){
  const value=field.split('.').reduce((o,k)=>o?.[k],c),text=Array.isArray(value)?value.map(clean).filter(Boolean).join(', '):clean(value);if(!text)continue;
  // Fragmentos acotados; no se descarta silenciosamente el final de una descripción extensa.
  for(let offset=0,part=0;offset<text.length;offset+=3000,part++){
   const body=context+'\n'+label+': '+text.slice(offset,offset+3000);if(body.length>4000)throw Error('DOCUMENT_CONTEXT_TOO_LONG');
   documents.push({_id:churchId+':'+field+':'+part,churchId,title,text:body,textHash:digest(body),documentVersion:VERSION,source:{kind:'church-public-field',field,part,updatedAt:source.updatedAt||null,churchVersion:source.metadata?.version??null},testData:source.metadata?.testData===true});
  }
 }
 return documents;
}
function planSync(documents,existing=[]){
 const wanted=new Map(documents.map(d=>[d._id,d]));if(wanted.size!==documents.length)throw Error('DUPLICATE_DOCUMENT');
 const previous=new Map(existing.map(d=>[d._id,d]));
 return {upsert:documents.filter(d=>{const old=previous.get(d._id);return !old||old.textHash!==d.textHash||old.documentVersion!==d.documentVersion;}),remove:existing.filter(d=>!wanted.has(d._id)).map(d=>d._id),unchanged:documents.filter(d=>{const old=previous.get(d._id);return old&&old.textHash===d.textHash&&old.documentVersion===d.documentVersion;}).length};
}
module.exports={VERSION,fields,eligible,prepareChurch,planSync};
