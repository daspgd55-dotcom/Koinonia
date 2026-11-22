// Muestra revisada de una instantánea local. No conecta a MongoDB.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {inventory,embed,inputText,vector}=require('../src/services/local-embeddings.lab');
const directory=path.resolve(__dirname,'../../outputs/church-embeddings-local'),source='plan-2026-11-18T05-13-40-909Z.json';
const selections=[
 ...['e6d7e42e79ea95ae9e831496','155555f8b883bb7066754b67','1298af8033c6eb4a402bf5a3'].flatMap(id=>['community.ministries','community.activities','doctrine.characteristics'].map(field=>id+':'+field+':0')),
 ...['identification.description','identification.distinctiveFeatures','doctrine.characteristics','community.description','community.activities'].map(field=>'6ac9b9225017eda79d91466c:'+field+':0'),
 '28f6ea99cc25a2cd1462203d:identification.description:0'
];
const sha=value=>createHash('sha256').update(value).digest('hex');
async function main(){
 const args=process.argv.slice(2);if(args.length>1||args.some(a=>a!=='--generate'))throw Error('INVALID_ARGUMENT');
 const raw=await fs.readFile(path.join(directory,source),'utf8'),plan=JSON.parse(raw);
 if(plan.database!=='koinonia_synthetic_test_v2_local'||plan.documentVersion!=='church-public-text-v1')throw Error('UNEXPECTED_SOURCE');
 const documents=selections.map(id=>{const matches=plan.items.filter(d=>d._id===id);if(matches.length!==1)throw Error('SAMPLE_SOURCE_MISSING');const d=matches[0];if(sha(d.text)!==d.textHash)throw Error('TEXT_HASH_MISMATCH');inputText(d,'document');return d;});
 const sample={source,sourceHash:sha(raw),selection:'five-churches-reviewed-v1',reviewScope:'Text suitability only; not factual verification or current visibility certification',documents};
 const manifest=path.join(directory,'sample-reviewed.json');
 if(!args.length){
  await fs.writeFile(manifest,JSON.stringify(sample,null,2)+'\n');
  const intro='# Muestra revisada para embeddings\n\n15 fragmentos de 5 fichas. Selección deliberada, no aleatoria ni representativa. Instantánea del 18/11/2026. No se corrigieron ni tradujeron los textos.\n\nRevisión: no se observaron contactos ni nombres de personas. Los nombres institucionales son públicos en la instantánea. Las etiquetas sintéticas no certifican servicios reales; testData=false tampoco acredita autenticidad. No se verificó de nuevo la visibilidad actual en MongoDB.\n\nHallazgos: corpus dominado por etiquetas; 4 descripciones extensas en el plan completo, 3 en inglés. Se conserva una descripción inglesa para una futura prueba multilingüe. La redacción de Alma contiene errores ortográficos y afirmaciones institucionales sin comprobación externa. No se infieren horarios, disponibilidad ni accesibilidad. Se excluyeron los fragmentos geográficos aislados porque el contexto ya incluye comuna/ciudad.\n\n';
  await fs.writeFile(path.join(directory,'sample-review.md'),intro+documents.map((d,i)=>'## '+(i+1)+'. '+d.title+'\n\nCampo: `'+d.source.field+'` · testData: '+d.testData+'\n\n'+d.text+'\n').join('\n'));
  console.log('Preparados sample-reviewed.json y sample-review.md; sin llamadas a Ollama.');return;
 }
 const reviewed=JSON.parse(await fs.readFile(manifest,'utf8'));if(JSON.stringify(reviewed)!==JSON.stringify(sample))throw Error('REVIEWED_SAMPLE_CHANGED');
 const baseUrl='http://127.0.0.1:11435',model=await inventory(baseUrl),expected='85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1';
 if(model.digest!==expected)throw Error('MODEL_DIGEST_CHANGED_REVIEW_REQUIRED');
 const result=await embed(documents,'document',{baseUrl}),after=await inventory(baseUrl);if(after.digest!==model.digest)throw Error('MODEL_CHANGED_DURING_RUN');
 if(result.vectors.length!==documents.length)throw Error('VECTOR_COUNT_MISMATCH');result.vectors.forEach(vector);
 const at=new Date().toISOString(),stamp=at.replace(/[:.]/g,'-'),report={createdAt:at,source,sourceHash:sample.sourceHash,selection:sample.selection,model,churches:new Set(documents.map(d=>d.churchId)).size,documents:documents.length,metrics:result.metrics,checks:{reviewedManifestMatches:true,textHashesMatch:true,modelDigestStable:true,dimensionsAndFiniteValues:true},limitations:['No retrieval evaluation','No current database visibility recheck','No remote writes']};
 await fs.writeFile(path.join(directory,'sample-vectors-'+stamp+'.json'),JSON.stringify({...report,items:documents.map((d,i)=>({...d,inputHash:sha(inputText(d,'document')),embedding:result.vectors[i]}))},null,2)+'\n');
 await fs.writeFile(path.join(directory,'sample-report-'+stamp+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(JSON.stringify({name:e.name,reason:/^[A-Z_0-9]+$/.test(e.message)?e.message:'LOCAL_SAMPLE_FAILED'}));process.exitCode=1;});
