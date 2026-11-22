const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const cases=require('./fixtures/search-intent-evaluation.cjs'),{parseQuery}=require('../src/services/search-requirements.lab'),{buildIntent,assessCandidates}=require('../src/services/search-intent.lab');
const hash=s=>createHash('sha256').update(s).digest('hex'),canonical=list=>JSON.stringify(list.map(c=>JSON.stringify(c)).sort());
async function main(){
 const rows=cases.map(c=>{const actual=parseQuery(c.text),expected=c.expected,extracted=actual.criteria.length>0&&!actual.unresolved.length;
  const exactRequirements=canonical(actual.criteria)===canonical(expected.requirements);
  const complete=expected.kind==='required'?extracted&&exactRequirements:expected.kind==='clarify'?!extracted:false;
  return {...c,actual:{requirements:actual,interests:[],classification:extracted?'required':'unresolved'},exactRequirements,complete,unsafeExtraction:extracted&&(!exactRequirements||['clarify','out_of_scope','descriptive'].includes(expected.kind))};
 });
 const categories={};for(const kind of new Set(cases.map(c=>c.expected.kind))){const group=rows.filter(r=>r.expected.kind===kind);categories[kind]={total:group.length,complete:group.filter(r=>r.complete).length,abstained:group.filter(r=>r.actual.classification==='unresolved').length,unsafeExtraction:group.filter(r=>r.unsafeExtraction).length};}
 // Controles del canal separado: no evalúan división automática de una frase libre.
 const church={_id:'a',active:true,metadata:{dataStatus:'published'},location:{commune:'Macul'},community:{activities:['Campamentos']}},candidates=[{churchId:'a',score:0.99},{churchId:'missing',score:1}];let checks=0;
 const check=fn=>{fn();checks++;};
 check(()=>assert.throws(()=>buildIntent({})));
 check(()=>assert.throws(()=>buildIntent({interestText:'historia',skipRequirements:true})));
 check(()=>{const p=buildIntent({requirementsText:'Necesito una iglesia en Macul',interestText:'historias de esperanza'});assert.equal(p.requirements.criteria[0].value,'Macul');assert.equal(p.interests[0].provesCompliance,false);});
 check(()=>{const r=assessCandidates(candidates,[church],{requirementsText:'Busco una iglesia sin campamentos',interestText:'una comunidad acogedora'});assert.equal(r.accepted.length,0);assert.equal(r.held[0].validation.status,'not_satisfied');});
 check(()=>{const r=assessCandidates(candidates,[church],{requirementsText:'Busco una iglesia a cinco minutos',interestText:'historia'});assert.equal(r.accepted.length,0);assert.ok(r.intent.needsClarification);});
 check(()=>{const r=assessCandidates(candidates,[church],{interestText:'historia'});assert.equal(r.accepted.length,1);assert.equal(r.accepted[0].validation.status,'not_required');assert.equal(r.held.length,1);});
 check(()=>assert.equal(assessCandidates(candidates,[{...church,active:false}],{interestText:'historia'}).accepted.length,0));
 check(()=>assert.equal(assessCandidates(candidates,[{...church,metadata:{dataStatus:'draft'}}],{interestText:'historia'}).accepted.length,0));
 check(()=>assert.equal(assessCandidates(candidates,[church],{requirementsText:'Busco una iglesia con ascensor',interestText:'historia'}).accepted.length,0));
 const at=new Date().toISOString(),report={createdAt:at,fixtureHash:hash(JSON.stringify(cases)),parserHash:hash(await fs.readFile(path.resolve(__dirname,'../src/services/requirement-interpretation.lab.js'),'utf8')),total:rows.length,categories,channelChecks:checks,rows};
 const dir=path.resolve(__dirname,'../../outputs/church-embeddings-local'),stamp=at.replace(/[:.]/g,'-');await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(path.join(dir,'intent-baseline-'+stamp+'.json'),JSON.stringify(report,null,2)+'\n');
 await fs.writeFile(path.join(dir,'intent-cases-'+stamp+'.md'),'# Consultas nuevas y expectativas\n\nSintéticas, autoradas con conocimiento del proyecto; no son consultas independientes de usuarios. Expectativas fijadas antes de ejecutar.\n\n'+rows.map(r=>'## '+r.id+' — '+r.expected.kind+'\n\n'+r.text+'\n\nEsperado: '+JSON.stringify(r.expected)+'\n\nObservado: '+JSON.stringify(r.actual)+'\n').join('\n'));
 console.log(JSON.stringify({total:rows.length,categories,channelChecks:checks,report:'intent-baseline-'+stamp+'.json'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
