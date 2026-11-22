const MODEL='embeddinggemma:latest',DIMENSIONS=768,FORMAT_VERSION='embeddinggemma-retrieval-v1';
function endpoint(baseUrl){const url=new URL(baseUrl);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('LOCAL_ENDPOINT_REQUIRED');return url;}
function vector(value){
 if(!Array.isArray(value)||value.length!==DIMENSIONS||value.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw Error('INVALID_VECTOR');
 const norm=Math.hypot(...value);if(!Number.isFinite(norm)||norm<1e-12)throw Error('ZERO_VECTOR');return value.map(n=>n/norm);
}
function cosine(a,b){const x=vector(a),y=vector(b);return Math.max(-1,Math.min(1,x.reduce((sum,n,i)=>sum+n*y[i],0)));}
function inputText(item,kind){
 if(!item||typeof item.text!=='string'||!item.text.trim()||item.text.length>4000)throw Error('INVALID_TEXT');
 if(kind==='query')return 'task: search result | query: '+item.text.trim();
 if(kind!=='document')throw Error('INVALID_KIND');
 if(item.title!==undefined&&(typeof item.title!=='string'||item.title.length>200))throw Error('INVALID_TITLE');
 return 'title: '+(item.title?.trim()||'none')+' | text: '+item.text.trim();
}
async function request(baseUrl,path,body){
 const url=endpoint(baseUrl),response=await fetch(new URL(path,url),{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(180000),headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Error('OLLAMA_HTTP_'+response.status);
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>2*1024*1024)throw Error('RESPONSE_TOO_LARGE');chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function inventory(baseUrl){const tags=await request(baseUrl,'/api/tags'),model=tags.models?.find(m=>m.name===MODEL);if(!model?.digest)throw Error('LOCAL_MODEL_MISSING');return {model:MODEL,digest:model.digest,dimensions:DIMENSIONS,formatVersion:FORMAT_VERSION};}
async function embed(items,kind,{baseUrl='http://127.0.0.1:11435'}={}){
 if(!Array.isArray(items)||!items.length||items.length>32)throw Error('INVALID_BATCH');
 const inputs=items.map(item=>inputText(item,kind)),vectors=[],batches=[],started=Date.now();
 for(let i=0;i<inputs.length;i+=4){
  const batch=inputs.slice(i,i+4),at=Date.now(),data=await request(baseUrl,'/api/embed',{model:MODEL,input:batch,truncate:false,keep_alive:'5m',options:{num_gpu:0}});
  if(!['embeddinggemma',MODEL].includes(data.model)||!Array.isArray(data.embeddings)||data.embeddings.length!==batch.length)throw Error('INVALID_EMBEDDING_RESPONSE');
  vectors.push(...data.embeddings.map(vector));batches.push({count:batch.length,elapsedMs:Date.now()-at,promptTokens:data.prompt_eval_count,loadNs:data.load_duration});
 }
 return {vectors,metrics:{elapsedMs:Date.now()-started,batches}};
}
module.exports={MODEL,DIMENSIONS,FORMAT_VERSION,endpoint,vector,cosine,inputText,inventory,embed};
