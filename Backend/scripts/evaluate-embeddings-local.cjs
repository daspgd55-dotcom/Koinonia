const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const lab=require('../src/services/local-embeddings.lab'),{documents,queries}=require('./fixtures/embedding-retrieval.cjs');
const baseUrl='http://127.0.0.1:11435';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
(async()=>{
 const guards=[];function rejects(id,fn){let passed=false;try{fn();}catch{passed=true;}guards.push({id,passed});}
 rejects('remote_endpoint',()=>lab.endpoint('https://example.com'));
 rejects('url_credentials',()=>lab.endpoint('http://user:secret@localhost:11435'));
 rejects('wrong_dimensions',()=>lab.vector([1,2]));
 rejects('non_finite',()=>lab.vector(Array(768).fill(NaN)));
 rejects('zero_vector',()=>lab.vector(Array(768).fill(0)));
 rejects('empty_text',()=>lab.inputText({text:' '},'query'));
 const unit=Array(768).fill(0);unit[0]=1;guards.push({id:'cosine_identical',passed:Math.abs(lab.cosine(unit,unit)-1)<1e-9});
 const info=await lab.inventory(baseUrl);console.log('Modelo local disponible: '+info.model);
 console.log('Generando embeddings de '+documents.length+' documentos sintéticos...');const docs=await lab.embed(documents,'document',{baseUrl});
 console.log('Generando embeddings de '+queries.length+' consultas sintéticas...');const questions=await lab.embed(queries,'query',{baseUrl});
 const after=await lab.inventory(baseUrl);if(after.digest!==info.digest)throw Error('MODEL_CHANGED_DURING_EVALUATION');
 const rows=queries.map((q,i)=>{const ranking=documents.map((d,j)=>({id:d.id,score:lab.cosine(questions.vectors[i],docs.vectors[j])})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),rank=ranking.findIndex(r=>q.relevant.includes(r.id))+1;return {...q,top:ranking.slice(0,3),firstRelevantRank:rank||null,hitAt1:rank===1,hitAt3:rank>0&&rank<=3};});
 const scored=rows.filter(r=>!r.probe),createdAt=new Date().toISOString(),runId=createdAt.replace(/[:.]/g,'-');
 const report={version:'embedding-retrieval-v1',createdAt,model:info,baseUrl,fixtureHash:sha(JSON.stringify({documents,queries})),guards,summary:{queries:scored.length,hitAt1:scored.filter(r=>r.hitAt1).length,hitAt3:scored.filter(r=>r.hitAt3).length,mrr:scored.reduce((n,r)=>n+(r.firstRelevantRank?1/r.firstRelevantRank:0),0)/scored.length},metrics:{documents:docs.metrics,queries:questions.metrics},rows};
 const directory=path.resolve(__dirname,'../../outputs/embeddings-local');await fs.mkdir(directory,{recursive:true});
 await fs.writeFile(path.join(directory,'report-'+runId+'.json'),JSON.stringify(report,null,2)+'\n');
 await fs.writeFile(path.join(directory,'vectors-'+runId+'.json'),JSON.stringify({model:info,documents:documents.map((d,i)=>({...d,textHash:sha(lab.inputText(d,'document')),embedding:docs.vectors[i]})),queries:queries.map((q,i)=>({...q,embedding:questions.vectors[i]}))})+'\n');
 console.log(JSON.stringify({summary:report.summary,guardsPassed:guards.filter(g=>g.passed).length,guardsTotal:guards.length,report:path.join(directory,'report-'+runId+'.json')}));
 for(const row of rows)console.log(JSON.stringify({id:row.id,top:row.top,firstRelevantRank:row.firstRelevantRank,probe:!!row.probe}));
 if(guards.some(g=>!g.passed)||scored.some(r=>!r.hitAt3))process.exitCode=1;
})().catch(e=>{console.error('Evaluación interrumpida: '+e.message);process.exitCode=1;});
