// Ampliación local determinista; no lee ni escribe MongoDB.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {inventory,embed,inputText}=require('../src/services/local-embeddings.lab');
const sha=s=>createHash('sha256').update(s).digest('hex'),dir=path.resolve(__dirname,'../../outputs/church-embeddings-local');
async function main(){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--generate')||args.length>1)throw Error('INVALID_ARGUMENT');
 const raw=await fs.readFile(path.join(dir,'plan-2026-11-18T05-13-40-909Z.json'),'utf8'),plan=JSON.parse(raw),base=JSON.parse(await fs.readFile(path.join(dir,'sample-vectors-2026-11-18T05-21-16-806Z.json'),'utf8'));
 const selected=new Set(base.items.map(d=>d.churchId)),communes=new Map(plan.items.filter(d=>d.source.field==='location.commune').map(d=>[d.churchId,d.text.split('\n').at(-1)])),counts=new Map();for(const id of selected){const c=communes.get(id);counts.set(c,(counts.get(c)||0)+1);}
 const groups=new Map();for(const d of plan.items)if(['community.activities','community.ministries'].includes(d.source.field)&&!selected.has(d.churchId)){if(!groups.has(d.churchId))groups.set(d.churchId,[]);groups.get(d.churchId).push(d);}
 const added=[];while(selected.size<20&&groups.size){const id=[...groups.keys()].sort((a,b)=>(counts.get(communes.get(a))||0)-(counts.get(communes.get(b))||0)||a.localeCompare(b))[0];const c=communes.get(id);selected.add(id);counts.set(c,(counts.get(c)||0)+1);added.push(...groups.get(id));groups.delete(id);}
 const items=[...base.items.map(({embedding,inputHash,...d})=>d),...added];for(const d of items){if(sha(d.text)!==d.textHash)throw Error('INVALID_HASH');inputText(d,'document');if(/https?:|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+\d{7}/i.test(d.text))throw Error('CONTACT_REVIEW_REQUIRED');}
 const manifest={sourceHash:sha(raw),baseCreatedAt:base.createdAt,churches:selected.size,fragments:items.length,items};
 if(!args.length){await fs.writeFile(path.join(dir,'expanded-reviewed.json'),JSON.stringify(manifest,null,2)+'\n');await fs.writeFile(path.join(dir,'expanded-review.md'),'# Muestra ampliada\n\n20 iglesias; conserva las cinco originales. Se añaden etiquetas de actividades y ministerios, priorizando comunas menos representadas y luego ID estable. No es una muestra aleatoria ni datos verificados.\n\n'+added.map(d=>'## '+d.title+'\n\n'+d.text+'\n\nDato de prueba: '+d.testData+'\n').join('\n'));console.log(JSON.stringify({churches:selected.size,fragments:items.length,newFragments:added.length}));return;}
 const reviewed=JSON.parse(await fs.readFile(path.join(dir,'expanded-reviewed.json'),'utf8'));if(JSON.stringify(reviewed)!==JSON.stringify(manifest))throw Error('REVIEW_CHANGED');
 const baseUrl='http://127.0.0.1:11435',model=await inventory(baseUrl);if(JSON.stringify(model)!==JSON.stringify(base.model))throw Error('MODEL_MISMATCH');
 const vectors=new Map(base.items.map(d=>[d._id,d.embedding]));let elapsedMs=0;for(let i=0;i<added.length;i+=32){const batch=added.slice(i,i+32),r=await embed(batch,'document',{baseUrl});elapsedMs+=r.metrics.elapsedMs;batch.forEach((d,j)=>vectors.set(d._id,r.vectors[j]));}
 if((await inventory(baseUrl)).digest!==model.digest)throw Error('MODEL_CHANGED');
 const result={createdAt:new Date().toISOString(),sourceHash:manifest.sourceHash,model,churches:selected.size,documents:items.length,elapsedMs,items:items.map(d=>({...d,inputHash:sha(inputText(d,'document')),embedding:vectors.get(d._id)}))};
 await fs.writeFile(path.join(dir,'expanded-vectors-v1.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({churches:result.churches,documents:result.documents,elapsedMs}));
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
