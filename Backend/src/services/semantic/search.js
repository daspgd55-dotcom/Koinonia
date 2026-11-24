const {namespace,vectors,hash,limiter,fail,SemanticError}=require('./contracts');
const {buildIntent,assessCandidates}=require('../search-intent.lab'),{prepareChurch}=require('../church-embedding-document.lab'),{assessTopics}=require('../search-topic-evidence.lab');
// Puertos inyectados desde composición del servidor, nunca desde una petición del navegador.
function createSearch({config,provider,repository}){const run=limiter(config);return async function search(review,{signal}={}){
 let intent;try{intent=buildIntent(review);}catch{return {status:'needs_clarification',code:'INVALID_INTENT',review,results:[],fallback:{allowed:false}};}
 const base={intent,review,results:[],fallback:{allowed:false}};if(intent.needsClarification)return {...base,status:'needs_clarification',code:'UNRESOLVED_REQUIREMENTS'};
 const unavailable=code=>({...base,status:'unavailable',code,fallback:{allowed:false,suggestedAction:'Usa la búsqueda tradicional y confirma sus filtros. No se han descartado condiciones ni ejecutado otra búsqueda.'}});
 if(!config.enabled)return unavailable('DISABLED');
 try{return await run(async abort=>{
 const key=namespace(config.identity);if(namespace(provider.identity)!==key)fail('MODEL_MISMATCH');
 const snapshot=await repository.load({namespace:key,signal:abort});if(abort.aborted)fail('CANCELLED');if(snapshot.namespace!==key)fail('CORPUS_MISMATCH');if(!Array.isArray(snapshot.churches)||!Array.isArray(snapshot.items)||snapshot.items.length>10000)fail('INVALID_CORPUS');
 const current=new Map(snapshot.churches.flatMap(prepareChurch).map(d=>[d._id,d])),seen=new Set(),valid=[];
 for(const d of snapshot.items){if(seen.has(d._id))fail('INVALID_CORPUS');seen.add(d._id);const live=current.get(d._id);if(!live||live.textHash!==d.textHash||hash(d.text)!==d.textHash||live.documentVersion!==config.identity.documentVersion)continue;valid.push({...live,embedding:vectors([d.embedding],1,config.identity.dimensions)[0]});}
 const candidates=valid.map(d=>({churchId:d.churchId,title:d.title,field:d.source.field,fragment:d.text,score:0}));
 const checked=assessCandidates(candidates,snapshot.churches,review),allowed=new Set(checked.accepted.map(d=>d.churchId));
 if(!allowed.size)return {...base,status:'available',namespace:key,provenance:snapshot.provenance,...assessTopics(checked,valid),excludedDocuments:snapshot.items.length-valid.length};
 const response=await provider.embed({items:[{text:intent.interests.map(i=>i.text).join(' ')||intent.retrievalText}],kind:'query',signal:abort});if(abort.aborted)fail('CANCELLED');if(namespace(response.identity)!==key)fail('MODEL_MISMATCH');const [query]=vectors(response.vectors,1,config.identity.dimensions);
 const ranked=valid.filter(d=>allowed.has(d.churchId)).map(d=>({churchId:d.churchId,title:d.title,field:d.source.field,fragment:d.text,score:d.embedding.reduce((n,v,i)=>n+v*query[i],0)})).sort((a,b)=>b.score-a.score||a.churchId.localeCompare(b.churchId));
 const assessed=assessCandidates(ranked,snapshot.churches,review);return {...base,status:'available',namespace:key,provenance:snapshot.provenance,...assessTopics({...assessed,held:checked.held},valid),excludedDocuments:snapshot.items.length-valid.length};
 },signal);}catch(e){return unavailable(e instanceof SemanticError?e.code:'UNAVAILABLE');}
 };}
module.exports={createSearch};
