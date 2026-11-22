// Solo la copia autorizada y una colección sintética nueva; nunca carga modelos de la app.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {vector,cosine,inputText,MODEL,DIMENSIONS,FORMAT_VERSION}=require('../src/services/local-embeddings.lab');
const fixture=require('./fixtures/embedding-retrieval.cjs');
const database='koinonia_synthetic_test_v2_local',owner='koinonia-vector-lab-v1',indexName='embedding_cosine_v1';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const indexDefinition={fields:[{type:'vector',path:'embedding',numDimensions:DIMENSIONS,similarity:'cosine'},...['active','dataStatus','batch'].map(p=>({type:'filter',path:p}))]};
const directory=path.resolve(__dirname,'../../outputs/embeddings-local');
async function prepare(){
 const files=(await fs.readdir(directory)).filter(n=>/^vectors-[0-9TZ.-]+\.json$/.test(n)).sort();if(!files.length)throw Error('NO_VECTOR_ARTIFACT');
 const artifact=files.at(-1),raw=await fs.readFile(path.join(directory,artifact),'utf8'),data=JSON.parse(raw),batch=sha(raw);
 if(data.model?.model!==MODEL||data.model.dimensions!==DIMENSIONS||data.model.formatVersion!==FORMAT_VERSION||!/^[a-f0-9]{64}$/.test(data.model.digest||''))throw Error('INVALID_MODEL_METADATA');
 if(data.documents?.length!==fixture.documents.length||data.queries?.length!==fixture.queries.length)throw Error('FIXTURE_COUNT_MISMATCH');
 for(const [items,expected,kind] of [[data.documents,fixture.documents,'document'],[data.queries,fixture.queries,'query']]){
  if(new Set(items.map(d=>d.id)).size!==items.length)throw Error('DUPLICATE_FIXTURE');
  for(const item of items){const known=expected.find(d=>d.id===item.id);if(!known||known.text!==item.text||known.title!==item.title)throw Error('FIXTURE_CONTENT_MISMATCH');vector(item.embedding);if(kind==='document'&&item.textHash!==sha(inputText(known,kind)))throw Error('TEXT_HASH_MISMATCH');}
 }
 const documents=data.documents.map(d=>({_id:d.id,owner,batch,fixture:true,active:true,dataStatus:'published',title:d.title,text:d.text,textHash:d.textHash,source:{kind:'synthetic',fixtureId:d.id},model:data.model,embedding:d.embedding}));
 for(const [id,changes] of [['control_draft',{dataStatus:'draft'}],['control_inactive',{active:false}]])documents.push({...documents[0],...changes,_id:id,source:{kind:'synthetic',fixtureId:id}});
 return {artifact,batch,data,documents,collection:'rag_embeddings_lab_'+batch.slice(0,12)};
}
async function main(){
 const args=process.argv.slice(2),publicDns=args.includes('--public-dns'),actions=args.filter(a=>a!=='--public-dns');if(actions.some(a=>!['--apply','--verify'].includes(a))||actions.length>1||args.filter(a=>a==='--public-dns').length>1)throw Error('USE_NO_ARGUMENTS_OR_APPLY_OR_VERIFY');
 if(publicDns)require('node:dns').setServers(['1.1.1.1']);
 const plan=await prepare(),run=new Date().toISOString().replace(/[:.]/g,'-');
 const summary={database,collection:plan.collection,source:plan.artifact,documents:plan.documents.length,indexName,indexDefinition};
 await fs.writeFile(path.join(directory,'vector-search-plan.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({phase:'plan',...summary}));if(!actions.length)return;
 const env=require('dotenv').parse(await fs.readFile(path.resolve(__dirname,'../.env'),'utf8')),uri=env.MONGO_URI;
 if(!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri))throw Error('MISSING_MONGO_CONFIG');
 const target=uri.slice(uri.indexOf('://')+3).split('/').slice(1).join('/').split('?')[0];
 if(decodeURIComponent(target)!==database)throw Error('DATABASE_NOT_AUTHORIZED');
 const {MongoClient}=require('mongoose').mongo,client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,connectTimeoutMS:15000,socketTimeoutMS:30000});
 const report={createdAt:new Date().toISOString(),...summary,batch:plan.batch,model:plan.data.model,phase:'connecting'};
 try{
  await client.connect();const db=client.db(database),collection=db.collection(plan.collection);report.serverVersion=(await db.command({buildInfo:1})).version;
  console.log(JSON.stringify({phase:'connected',database,serverVersion:report.serverVersion}));
  const exists=await db.listCollections({name:plan.collection},{nameOnly:true}).hasNext();
  if(!exists){if(actions[0]!=='--apply')throw Error('LAB_COLLECTION_MISSING');await db.createCollection(plan.collection);}
  const existing=await collection.find({},{projection:{_id:1,owner:1,batch:1}}).toArray();
  if(existing.some(d=>d.owner!==owner||d.batch!==plan.batch||!plan.documents.some(p=>p._id===d._id)))throw Error('COLLECTION_OWNERSHIP_MISMATCH');
  const indexes=await collection.listSearchIndexes().toArray(),index=indexes.find(i=>i.name===indexName);
  if(!index){if(actions[0]!=='--apply')throw Error('LAB_INDEX_MISSING');await collection.createSearchIndex({name:indexName,type:'vectorSearch',definition:indexDefinition});console.log('Índice solicitado; la creación es asíncrona.');}
  else if(JSON.stringify(index.latestDefinition)!==JSON.stringify(indexDefinition))throw Error('INDEX_DEFINITION_MISMATCH');
  if(actions[0]==='--apply'){
   const missing=plan.documents.filter(d=>!existing.some(e=>e._id===d._id));if(missing.length)await collection.insertMany(missing,{ordered:true});
  }
  const actual=await collection.find({}).toArray();if(actual.length!==plan.documents.length||actual.some(d=>{const expected=plan.documents.find(x=>x._id===d._id);return !expected||d.active!==expected.active||d.dataStatus!==expected.dataStatus||d.textHash!==expected.textHash||sha(JSON.stringify(d.embedding))!==sha(JSON.stringify(expected.embedding));}))throw Error('PERSISTED_FIXTURE_MISMATCH');
  report.phase='indexing';const deadline=Date.now()+120000;let ready=false,attempt=0;
  while(Date.now()<deadline){const state=(await collection.listSearchIndexes(indexName).toArray())[0];if(state?.status==='FAILED')throw Error('SEARCH_INDEX_FAILED');if(state?.queryable){const all=await collection.aggregate([{$vectorSearch:{index:indexName,path:'embedding',queryVector:plan.data.queries[0].embedding,exact:true,limit:plan.documents.length}},{$project:{_id:1}}],{maxTimeMS:15000}).toArray();if(all.length===plan.documents.length){ready=true;break;}}
   if(attempt++%5===0)console.log(JSON.stringify({phase:'indexing',status:state?.status||'pending'}));await new Promise(resolve=>setTimeout(resolve,3000));
  }
  if(!ready)throw Error('INDEX_NOT_READY_RETRY_VERIFY');
  report.phase='querying';report.rows=[];
  for(const query of plan.data.queries){
   const at=Date.now(),rows=await collection.aggregate([{$vectorSearch:{index:indexName,path:'embedding',queryVector:query.embedding,exact:true,limit:fixture.documents.length,filter:{active:true,dataStatus:'published',batch:plan.batch}}},{$project:{_id:1,active:1,dataStatus:1,score:{$meta:'vectorSearchScore'}}},{$sort:{score:-1,_id:1}}],{maxTimeMS:15000}).toArray();
   const baseline=plan.data.documents.map(d=>({id:d.id,score:(1+cosine(query.embedding,d.embedding))/2})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
   const parity=rows.length===baseline.length&&rows.every((r,i)=>r._id===baseline[i].id&&Math.abs(r.score-baseline[i].score)<1e-5),visibility=rows.length===fixture.documents.length&&rows.every(r=>r.active&&r.dataStatus==='published'&&!r._id.startsWith('control_'));
   report.rows.push({id:query.id,parity,visibility,elapsedMs:Date.now()-at,top:rows.slice(0,3).map(r=>({id:r._id,score:r.score}))});
  }
  report.passed=report.rows.every(r=>r.parity&&r.visibility);report.phase='complete';console.log(JSON.stringify({phase:report.phase,passed:report.passed,queries:report.rows.length}));if(!report.passed)process.exitCode=1;
 }catch(e){report.error={name:e.name,code:e.code||null,reason:/^[A-Z_]+$/.test(e.message)?e.message:'MONGODB_OPERATION_FAILED'};console.error(JSON.stringify(report.error));process.exitCode=1;}
 finally{await client.close();const file=path.join(directory,'vector-search-'+run+'.json');await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');console.log('Informe: '+file);}
}
main().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:e.name);process.exitCode=1;});
