const {test}=require('node:test'),assert=require('node:assert/strict'),{rank}=require('../src/services/recommendation.service'),{quality}=require('../src/services/church-quality.service');
const basic={_id:'1',metadata:{dataStatus:'published'},christianIdentity:{denomination:'Bautista'},community:{activities:['Jóvenes']}};
test('Pertinencia: seis escenarios controlados de preferencias y completitud',()=>{
 const cases=[
 ['denominación',basic,{...basic,christianIdentity:{denomination:'Católica'}},{denominations:['Bautista']}],
 ['actividad',basic,{...basic,community:{activities:['Familias']}},{activities:['Jóvenes']}],
 ['distancia',{...basic,distanceMeters:100},{...basic,distanceMeters:4000},{radiusKm:5}],
 ['idioma',{...basic,christianIdentity:{languages:['Español']}},{...basic,christianIdentity:{languages:['Inglés']}},{languages:['Español']}],
 ['horario',{...basic,meetings:[{schedule:[{day:'Domingo'}]}]},{...basic,meetings:[{schedule:[{day:'Lunes'}]}]},{meetingDays:['Domingo']}],
 ['dato confirmado',basic,{...basic,community:{}},{activities:['Jóvenes']}]
 ];
 let correct=0;for(const [name,good,bad,p] of cases){const a=rank(good,p),b=rank(bad,p);assert.ok(a.score>b.score,name);correct++;}assert.equal(correct,6);
});
test('Criterios omitidos no reducen afinidad; calidad pesa como máximo cinco puntos',()=>{
 const p={denominations:['Bautista']},r=rank(basic,p);assert.ok(r.score>=.95);assert.equal(r.evidence.activeCriteria,1);
 const empty=rank({...basic,christianIdentity:{}},p);assert.equal(empty.criteria.denominations.status,'unknown');assert.equal(empty.evidence.knownCriteria,0);
 const mismatch=rank({...basic,christianIdentity:{denomination:'Católica'},metadata:{dataStatus:'verified'}},p);assert.ok(r.score>mismatch.score);
 const disabled=rank(basic,{...p,activities:['Otra']},{activities:'disabled'});assert.equal(disabled.score,r.score);
});
test('Calidad: completitud, verificación y vigencia; sin fechas no inventa actualización',()=>{
 const now=new Date('2026-10-15T00:00:00Z'),q=quality(basic,now);assert.equal(q.freshness,0);
 const recent=quality({...basic,verification:{lastUpdated:'2026-10-01'}},now),old=quality({...basic,verification:{lastUpdated:'2020-01-01'}},now);assert.ok(recent.score>old.score);
 assert.ok(quality({...basic,metadata:{dataStatus:'verified'}},now).score>q.score);
 assert.deepEqual(quality({...basic,privateFields:{email:true},contact:{email:'privado@example.test'}},now),q);
});
