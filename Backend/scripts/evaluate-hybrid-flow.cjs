const fs=require('node:fs/promises'),path=require('node:path');
const origin='http://127.0.0.1:4600';
const cases=[
 {id:'mixed-or',query:'Busco una iglesia en Ñuñoa o Providencia; me interesa participar en actividades deportivas.',clarify:false,communes:['Ñuñoa','Providencia'],evidence:'Actividades deportivas'},
 {id:'social',query:'Necesito una iglesia en Pedro Aguirre Cerda; me interesa colaborar con ayuda social.',clarify:false,communes:['Pedro Aguirre Cerda'],evidence:'Ayuda social'},
 {id:'required',query:'Busco una iglesia en Providencia con retiros.',clarify:false,communes:['Providencia'],evidence:'Retiros'},
 {id:'negative',query:'Busco una iglesia en Ñuñoa sin campamentos.',clarify:false,communes:['Ñuñoa'],noAccepted:true},
 {id:'unknown',query:'Necesito una iglesia con estacionamiento para bicicletas.',clarify:true},
 {id:'contradiction',query:'Busco una iglesia con ascensor; necesito una iglesia sin ascensor.',clarify:true},
 {id:'open',query:'Me interesa una comunidad con encuentros para practicar deportes.',clarify:false,evidence:'Actividades deportivas'},
 {id:'no-evidence',query:'Me interesa una iglesia que enseñe reparación de satélites.',clarify:false,noEvidence:true},
 {id:'edited',query:'Necesito una iglesia cerca de mi trabajo.',clarify:true,edit:{requirementsText:'Busco una iglesia en Providencia.',interestText:'participar en retiros'},communes:['Providencia'],evidence:'Retiros'}
];
async function post(route,body){const start=Date.now();const response=await fetch(origin+route,{method:'POST',redirect:'error',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const data=await response.json();if(!response.ok)throw Error('HTTP_'+response.status+': '+data.error);return {data,ms:Date.now()-start};}
async function main(){const dir=path.resolve('outputs/search-diagnostics/hybrid'),stamp=new Date().toISOString().replace(/[:.]/g,'-');await fs.mkdir(dir,{recursive:true});const file=path.join(dir,'evaluation-'+stamp+'.json'),report={createdAt:new Date().toISOString(),cases,rows:[],note:'Expectativas fijadas antes de consultar. Evidencia por etiqueta literal: indicador limitado, no valoración humana de utilidad.'};await fs.writeFile(file,JSON.stringify(report,null,2));
 for(const c of cases){let row={id:c.id};try{const first=await post('/interpret',{query:c.query});row.interpretationCorrect=first.data.intent.needsClarification===c.clarify;row.preview=first;const review=c.edit||first.data.review;const checked=await post('/interpret',{query:c.query,review});row.checked=checked;
 if(checked.data.intent.needsClarification){row.blocked=true;row.correct=row.interpretationCorrect&&!c.edit;}
 else{await new Promise(r=>setTimeout(r,2100));const result=await post('/query',{query:c.query,review});row.result=result;const accepted=result.data.accepted;row.locationSafe=!c.communes||accepted.every(r=>r.validation.requirements.some(x=>x.field==='location.commune'&&x.status==='satisfied'&&c.communes.includes(x.evidence?.value)));row.negativeSafe=!c.noAccepted||accepted.length===0;row.correct=row.interpretationCorrect&&row.locationSafe&&row.negativeSafe;row.firstEvidenceRank=c.evidence?accepted.findIndex(r=>r.fragment.includes(c.evidence))+1:null;row.top3=accepted.slice(0,3).map(r=>({title:r.title,fragment:r.fragment,score:r.score}));}
 }catch(e){row.error=e.message;row.correct=false;}report.rows.push(row);await fs.writeFile(file,JSON.stringify(report,null,2));console.log(JSON.stringify({id:c.id,correct:row.correct,blocked:row.blocked,ms:row.result?.ms,firstEvidenceRank:row.firstEvidenceRank,error:row.error}));}
 report.summary={cases:cases.length,correct:report.rows.filter(r=>r.correct).length,errors:report.rows.filter(r=>r.error).length,queried:report.rows.filter(r=>r.result).length};await fs.writeFile(file,JSON.stringify(report,null,2));console.log(JSON.stringify({file,summary:report.summary}));}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
