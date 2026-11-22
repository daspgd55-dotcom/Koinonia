const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {inventory,embed,cosine,vector,inputText}=require('../src/services/local-embeddings.lab');
const queries=require('./fixtures/church-sample-queries.cjs'),sha=s=>createHash('sha256').update(s).digest('hex');
async function main(){
 const directory=path.resolve(__dirname,'../../outputs/church-embeddings-local'),source='sample-vectors-2026-11-18T05-21-16-806Z.json',raw=await fs.readFile(path.join(directory,source),'utf8'),sample=JSON.parse(raw),baseUrl='http://127.0.0.1:11435';
 const model=await inventory(baseUrl);if(JSON.stringify(model)!==JSON.stringify(sample.model))throw Error('MODEL_MISMATCH');
 if(sample.items.length!==15||new Set(sample.items.map(d=>d._id)).size!==15)throw Error('SAMPLE_MISMATCH');
 for(const d of sample.items){vector(d.embedding);if(sha(d.text)!==d.textHash||sha(inputText(d,'document'))!==d.inputHash)throw Error('CONTENT_HASH_MISMATCH');}
 for(const q of queries)if(q.relevant.some(id=>!sample.items.some(d=>d._id===id)))throw Error('UNKNOWN_EXPECTED_DOCUMENT');
 const generated=await embed(queries,'query',{baseUrl});if((await inventory(baseUrl)).digest!==model.digest)throw Error('MODEL_CHANGED');
 const rows=queries.map((q,i)=>{const ranking=sample.items.map(d=>({id:d._id,church:d.title,field:d.source.field,score:cosine(generated.vectors[i],d.embedding),text:d.text,relevant:q.relevant.includes(d._id)})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));const rank=ranking.findIndex(d=>d.relevant)+1;return {...q,firstRelevantRank:rank||null,ranking};});
 const main=rows.filter(q=>!q.probe),summary={queries:rows.length,answerable:main.length,probes:rows.length-main.length,hitAt1:main.filter(q=>q.firstRelevantRank===1).length,hitAt3:main.filter(q=>q.firstRelevantRank&&q.firstRelevantRank<=3).length,mrr:main.reduce((s,q)=>s+(q.firstRelevantRank?1/q.firstRelevantRank:0),0)/main.length};
 const createdAt=new Date().toISOString(),stamp=createdAt.replace(/[:.]/g,'-'),report={createdAt,source,sourceHash:sha(raw),fixtureHash:sha(JSON.stringify(queries)),model,summary,metrics:generated.metrics,rows};
 await fs.writeFile(path.join(directory,'query-report-'+stamp+'.json'),JSON.stringify(report,null,2)+'\n');
 await fs.writeFile(path.join(directory,'query-vectors-'+stamp+'.json'),JSON.stringify({createdAt,model,queries:queries.map((q,i)=>({...q,embedding:generated.vectors[i]}))},null,2)+'\n');
 const header='# Consultas sobre la muestra\n\nEvaluación local por coseno, sin MongoDB, filtros estructurados, Qwen ni generación de respuestas. Relevancia fijada antes de ejecutar. Muestra deliberada pequeña: no estima precisión en producción. Los casos sin evidencia no entran en Hit@k/MRR. No hay umbral de abstención calibrado: siempre se muestran vecinos aunque no respondan.\n\n'+JSON.stringify(summary)+'\n\n';
 await fs.writeFile(path.join(directory,'query-review-'+stamp+'.md'),header+rows.map(q=>'## '+q.id+'\n\n'+q.text+'\n\n'+(q.probe||'Primer fragmento pertinente en posición '+q.firstRelevantRank)+ '\n\n'+q.ranking.slice(0,3).map((r,i)=>(i+1)+'. **'+r.church+'** — '+r.field+'; coseno '+r.score.toFixed(4)+'; '+(r.relevant?'pertinente':'sin etiqueta de pertinencia')+'\n\n   '+r.text.replace(/\n/g,' ')+'\n').join('\n')).join('\n'));
 console.log(JSON.stringify({summary,metrics:generated.metrics,report:'query-report-'+stamp+'.json',top:rows.map(q=>({id:q.id,rank:q.firstRelevantRank,church:q.ranking[0].church,score:q.ranking[0].score}))}));
}
main().catch(e=>{console.error(JSON.stringify({name:e.name,reason:/^[A-Z_]+$/.test(e.message)?e.message:'LOCAL_QUERY_EVALUATION_FAILED'}));process.exitCode=1;});
