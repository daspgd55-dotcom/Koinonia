const {fs,path,root,sha,canonical,versions}=require('./search-diagnostics.cjs');
const shadow=require('../src/services/qwen-intent-shadow.lab'),{interpretFreeText}=require('../src/services/free-search-intent.lab'),fixture=require('./fixtures/search-intent-evaluation.cjs');
// Selección previa: requisitos claros/paráfrasis, ambigüedad, descripción, mezcla e instrucción ajena.
const selected=[0,8,9,11,16,20,23,28,29,33,36,39];
const stable=cs=>JSON.stringify(cs.map(c=>JSON.stringify({...c,...(Array.isArray(c.value)?{value:[...c.value].sort()}:{} )})).sort());
const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function judge(actual,expected){if(!actual)return false;if(['clarify','out_of_scope'].includes(expected.kind))return actual.needsClarification;return !actual.needsClarification&&actual.kind===expected.kind&&stable(actual.requirements.criteria)===stable(expected.requirements)&&expected.interests.every(s=>actual.interests.some(i=>normalized(i.text).includes(normalized(s))))&&actual.interests.length===expected.interests.length;}
async function main(){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--structured')||args.length>1)throw Error('INVALID_ARGUMENT');const structured=args.includes('--structured'),model=await shadow.modelInfo(),dir=path.join(root,'outputs/search-diagnostics/qwen-shadow');await fs.mkdir(dir,{recursive:true});
 const at=new Date().toISOString(),stamp=at.replace(/[:.]/g,'-'),file=path.join(dir,'comparison-'+stamp+'.json'),cases=selected.map(i=>fixture[i]);
 const report={createdAt:at,model,format:structured?'json_schema':'json',applied:false,fixtureHash:sha(JSON.stringify(cases)),promptHash:sha(shadow.SYSTEM),shadowCodeHash:sha(await fs.readFile(path.join(root,'Backend/src/services/qwen-intent-shadow.lab.js'),'utf8')),versions:await versions(),scope:'Conjunto de desarrollo conocido, subconjunto fijo; no precisión de usuarios reales.',status:'running',rows:[]};
 await fs.writeFile(file,JSON.stringify({...report,cases},null,2)+'\n');
 for(const c of cases){const rules=interpretFreeText(c.text);let qwen;try{qwen=await shadow.interpret(c.text,{structured});}catch(e){qwen={accepted:false,error:e.name==='TimeoutError'?'TIMEOUT':'MODEL_REQUEST_FAILED'};}
  const row={id:c.id,query:c.text,expected:c.expected,rules,qwen,rulesCorrect:judge(rules,c.expected),qwenCorrect:judge(qwen.proposal,c.expected),disagreement:!qwen.proposal||JSON.stringify(canonical(rules))!==JSON.stringify(canonical(qwen.proposal))};report.rows.push(row);await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({case:c.id,rulesCorrect:row.rulesCorrect,qwenCorrect:row.qwenCorrect,accepted:qwen.accepted,error:qwen.error,elapsedMs:qwen.metrics?.elapsedMs}));
 }
 const after=await shadow.modelInfo();report.modelStable=after.digest===model.digest;report.status=report.modelStable?'complete':'invalid_model_changed';report.summary={cases:report.rows.length,rulesCorrect:report.rows.filter(r=>r.rulesCorrect).length,qwenCorrect:report.rows.filter(r=>r.qwenCorrect).length,validProposals:report.rows.filter(r=>r.qwen.accepted).length,disagreements:report.rows.filter(r=>r.disagreement).length,gains:report.rows.filter(r=>!r.rulesCorrect&&r.qwenCorrect).length,regressions:report.rows.filter(r=>r.rulesCorrect&&!r.qwenCorrect).length};
 await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');await fs.writeFile(path.join(dir,'comparison-'+stamp+'.md'),'# Qwen frente a reglas\n\n'+JSON.stringify(report.summary)+'\n\nPropuestas no aplicadas. JSON válido no garantiza interpretación correcta.\n\n'+report.rows.map(r=>'## '+r.id+'\n\n'+r.query+'\n\nReglas: '+r.rulesCorrect+' · Qwen: '+r.qwenCorrect+' · contrato válido: '+r.qwen.accepted+'\n\n'+JSON.stringify(r.qwen.proposal||{error:r.qwen.error})).join('\n\n'));
 console.log(JSON.stringify({summary:report.summary,file}));if(!report.modelStable)process.exitCode=1;
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
