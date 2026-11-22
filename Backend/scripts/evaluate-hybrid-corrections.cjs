const assert=require('node:assert/strict'),{interpretFreeText}=require('../src/services/free-search-intent.lab'),{buildIntent}=require('../src/services/search-intent.lab'),{assessTopics}=require('../src/services/search-topic-evidence.lab'),{exportSchema}=require('./search-diagnostics.cjs');
let count=0;function check(name,fn){fn();count++;console.log('OK '+name);}
for(const [q,n] of [['Busco una iglesia en Providencia con retiros.',2],['Busco una iglesia en Ñuñoa sin campamentos.',2],['Busco una iglesia en Ñuñoa o Macul con retiros sin campamentos.',3],['Busco una iglesia con retiros en Providencia.',2]])check(q,()=>{const i=interpretFreeText(q);assert.equal(i.needsClarification,false);assert.equal(i.requirements.criteria.length,n);});
check('negación conservada',()=>assert.equal(interpretFreeText('Busco una iglesia en Ñuñoa sin campamentos.').requirements.criteria[1].polarity,'exclude'));
for(const q of ['Busco una iglesia en Providencia con satélites.','Busco una iglesia con retiros sin retiros.','Busco una iglesia en Providencia con retiros o campamentos.'])check('aclaración: '+q,()=>assert.equal(interpretFreeText(q).needsClarification,true));
const intent=buildIntent({requirementsText:'Busco una iglesia en Providencia.',interestText:'retiros'});
for(const legacy of [false,true])check('feedback '+(legacy?'anterior':'nuevo'),()=>{const i={...intent};if(legacy)delete i.kind;const p=exportSchema.parse({schema:'koinonia-search-lab-feedback-v1',records:[{key:'test',query:'test',mode:'interest',kind:'interpretation',rating:'useful',updatedAt:new Date().toISOString(),intent:i,result:null}]});assert.equal(p.records[0].intent.kind,'mixed');});
const fragments=[{churchId:'a',text:'Iglesia: Satélites · Providencia\nActividades: Retiros, Actividades deportivas',source:{field:'community.activities'}}],row={churchId:'a',validation:{status:'satisfied'}};
function topic(text){return assessTopics({intent:buildIntent({interestText:text}),accepted:[row],held:[]},fragments);}
check('evidencia positiva',()=>assert.equal(topic('actividades deportivas').accepted.length,1));
check('sin evidencia aunque nombre coincida',()=>{const r=topic('reparación de satélites');assert.equal(r.accepted.length,0);assert.equal(r.exploratory.length,1);});
check('palabras genéricas no bastan',()=>assert.equal(topic('iglesia comunidad').accepted.length,0));
check('interés compuesto incompleto',()=>assert.equal(topic('retiros y reparación de satélites').accepted.length,0));
check('requisitos retenidos no se promocionan',()=>{const r=assessTopics({intent,accepted:[],held:[row]},fragments);assert.equal(r.accepted.length,0);assert.equal(r.held.length,1);});
console.log(count+' comprobaciones correctas; sin servicios externos.');
