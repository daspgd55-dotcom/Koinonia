const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {inventory,embed,cosine,inputText,vector}=require('../src/services/local-embeddings.lab'),queries=require('./fixtures/expanded-retrieval-queries.cjs');
const sha=s=>createHash('sha256').update(s).digest('hex');
async function main(){
 const dir=path.resolve(__dirname,'../../outputs/church-embeddings-local'),raw=await fs.readFile(path.join(dir,'expanded-vectors-v1.json'),'utf8'),sample=JSON.parse(raw);
 for(const d of sample.items){vector(d.embedding);if(sha(d.text)!==d.textHash||sha(inputText(d,'document'))!==d.inputHash)throw Error('INVALID_ARTIFACT');}
 const labeled=queries.map(q=>({...q,relevant:q.noEvidence?[]:sample.items.filter(d=>d.source.field===q.field&&d.text.split('\n').at(-1).split(': ').slice(1).join(': ').split(', ').includes(q.tag)).map(d=>d._id)}));
 if(labeled.some(q=>!q.noEvidence&&!q.relevant.length))throw Error('POSITIVE_WITHOUT_EVIDENCE');
 // Persistir expectativas antes de la llamada al modelo.
 await fs.writeFile(path.join(dir,'expanded-query-expectations.json'),JSON.stringify({sourceHash:sha(raw),queries:labeled},null,2)+'\n');
 const baseUrl='http://127.0.0.1:11435',model=await inventory(baseUrl);if(JSON.stringify(model)!==JSON.stringify(sample.model))throw Error('MODEL_MISMATCH');
 const generated=await embed(queries,'query',{baseUrl});if((await inventory(baseUrl)).digest!==model.digest)throw Error('MODEL_CHANGED');
 const rows=labeled.map((q,i)=>{const ranking=sample.items.map(d=>({id:d._id,title:d.title,text:d.text,score:cosine(generated.vectors[i],d.embedding),relevant:q.relevant.includes(d._id)})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));return {...q,firstRelevantRank:q.noEvidence?null:ranking.findIndex(d=>d.relevant)+1,ranking};});
 const positives=rows.filter(r=>!r.noEvidence),negatives=rows.filter(r=>r.noEvidence),summary={documents:sample.items.length,churches:sample.churches,positiveQueries:positives.length,hitAt1:positives.filter(r=>r.firstRelevantRank===1).length,hitAt3:positives.filter(r=>r.firstRelevantRank<=3).length,noEvidenceQueries:negatives.length,positiveTopRange:[Math.min(...positives.map(r=>r.ranking[0].score)),Math.max(...positives.map(r=>r.ranking[0].score))],noEvidenceTopRange:[Math.min(...negatives.map(r=>r.ranking[0].score)),Math.max(...negatives.map(r=>r.ranking[0].score))]};
 const at=new Date().toISOString(),stamp=at.replace(/[:.]/g,'-'),report={createdAt:at,sourceHash:sha(raw),fixtureHash:sha(JSON.stringify(queries)),model,summary,metrics:generated.metrics,rows};
 await fs.writeFile(path.join(dir,'expanded-evaluation-'+stamp+'.json'),JSON.stringify(report,null,2)+'\n');
 await fs.writeFile(path.join(dir,'expanded-evaluation-'+stamp+'.md'),'# Evaluación ampliada\n\n'+JSON.stringify(summary)+'\n\nSin umbral calibrado: cercanía temática no confirma requisitos. No evidencia significa ausencia en estos fragmentos, no ausencia en las iglesias.\n\n'+rows.map(r=>'## '+r.id+'\n\n'+r.text+'\n\n'+(r.noEvidence||'Primer fragmento pertinente: '+r.firstRelevantRank)+'\n\n'+r.ranking.slice(0,3).map(d=>'- '+d.title+' · '+d.score.toFixed(4)+' · '+(d.relevant?'evidencia etiquetada':'sin etiqueta pertinente')+'\n\n  '+d.text.replace(/\n/g,' ')).join('\n')).join('\n\n'));
 console.log(JSON.stringify({summary,report:'expanded-evaluation-'+stamp+'.json',noEvidence:negatives.map(r=>({id:r.id,top:r.ranking[0].title,score:r.ranking[0].score}))}));
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
