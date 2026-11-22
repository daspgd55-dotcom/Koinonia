// Evaluación aislada: sin red, MongoDB ni datos reales.
const assert=require('node:assert/strict'),{parseQuery,validate,evaluateChurch,filterCandidates}=require('../src/services/search-requirements.lab');
const church={_id:'fixture',active:true,metadata:{dataStatus:'published'},community:{activities:['Actividades deportivas']},location:{commune:'Ñuñoa',accessibilityDetails:{ramp:'no',accessibleRestroom:'partial',signLanguage:'yes'}}};
const req=(field,value,polarity='include')=>({criteria:[{field,value,polarity}],unresolved:[]});let checks=0;
function check(fn){fn();checks++;}
check(()=>assert.equal(evaluateChurch(church,parseQuery('Busco una iglesia que no realice actividades deportivas.')).status,'not_satisfied'));
check(()=>assert.equal(evaluateChurch({...church,community:{activities:[]}},parseQuery('Busco una iglesia sin actividades deportivas')).status,'unknown'));
check(()=>assert.equal(evaluateChurch(church,parseQuery('Busco una iglesia con actividades deportivas')).status,'satisfied'));
check(()=>assert.equal(evaluateChurch(church,req('location.accessibilityDetails.ramp','yes')).status,'not_satisfied'));
check(()=>assert.equal(evaluateChurch(church,req('location.accessibilityDetails.ramp','yes','exclude')).status,'satisfied'));
check(()=>assert.equal(evaluateChurch(church,req('location.accessibilityDetails.accessibleRestroom','yes')).status,'unknown'));
check(()=>assert.equal(evaluateChurch({...church,privateFields:{accessibilityDetails:true}},req('location.accessibilityDetails.signLanguage','yes')).status,'unknown'));
check(()=>assert.equal(evaluateChurch(church,req('location.commune','nunoa')).status,'satisfied'));
check(()=>assert.equal(evaluateChurch(church,req('location.commune','Providencia')).status,'not_satisfied'));
check(()=>assert.equal(evaluateChurch({...church,active:false},req('location.commune','Ñuñoa')).status,'ineligible'));
check(()=>assert.equal(parseQuery('No quiero una iglesia sin actividades deportivas').unresolved.length,1));
check(()=>assert.equal(parseQuery('Busco una iglesia con actividades deportivas y sin música').unresolved.length,1));
check(()=>assert.equal(parseQuery('Busco una iglesia con deportes o música').unresolved.length,1));
check(()=>assert.equal(parseQuery('Busco una iglesia con reunión el martes a las ocho').unresolved.length,1));
check(()=>assert.equal(parseQuery('Necesito una iglesia con intérprete de lengua de señas y baño accesible.').criteria.length,2));
check(()=>assert.equal(evaluateChurch(church,parseQuery('Necesito una iglesia con intérprete de lengua de señas y baño accesible.')).status,'unknown'));
check(()=>assert.throws(()=>validate({criteria:[{field:'location.commune',value:'Ñuñoa',polarity:'include'},{field:'location.commune',value:'nunoa',polarity:'exclude'}],unresolved:[]})));
check(()=>assert.throws(()=>validate(req('contact.email','x'))));
check(()=>assert.equal(evaluateChurch(church,{criteria:[],unresolved:[]}).status,'unknown'));
check(()=>{const r=filterCandidates([{churchId:'fixture',score:0.99},{churchId:'missing',score:1}],[church],parseQuery('Busco una iglesia sin actividades deportivas'));assert.equal(r.accepted.length,0);assert.equal(r.held.length,2);});
console.log(JSON.stringify({passed:checks,total:20,network:false,databaseWrites:false}));
