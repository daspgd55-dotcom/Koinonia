const {test}=require('node:test'),assert=require('node:assert/strict'),{Types}=require('mongoose');
const {groups,selectChurches,build,excluded}=require('../scripts/create-more-test-events'),Event=require('../src/models/event.model'),svc=require('../src/services/event.service');
const actor={_id:new Types.ObjectId(),role:'admin',name:'Administrador de pruebas'},now=new Date('2026-10-21T12:00:00-03:00');
const names={catolica:'Parroquia Santa Comunidad',bautista:'Iglesia Bautista',presbiteriana:'Iglesia Presbiteriana',pentecostal:'Iglesia Pentecostal',adventista:'Iglesia Adventista',metodista:'Iglesia Metodista',anglicana:'Iglesia Anglicana',asamblea:'Iglesia Asamblea de Dios'};
function churches(){return groups.flatMap(g=>Array.from({length:g.count},(_,n)=>({_id:new Types.ObjectId(),identification:{name:names[g.key]+' '+n},active:true,metadata:{testData:true,dataStatus:'published'},christianIdentity:{denomination:g.denomination},location:{address:'Sede de prueba '+n,commune:n%2?'Providencia':'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},verification:{authorized:false}})));}
test('Selecciona 20 congregaciones con identidad concordante y excluye Alma',()=>{
 const a=churches();a.push({...a[0],_id:new Types.ObjectId('6ac9b9225017eda79d91466c'),identification:{name:'Parroquia Alma'}});
 const s=selectChurches(a);assert.equal(s.length,20);assert(s.every(x=>!excluded(x.church)));assert.equal(new Set(s.map(x=>String(x.church._id))).size,20);
 assert.throws(()=>selectChurches(a.filter(c=>!c.identification.name.includes('Anglicana'))));
});
test('Cuarenta publicaciones únicas cumplen esquema y requisitos reales de publicación',async()=>{
 const selected=selectChurches(churches()),events=build(selected,actor,now);assert.equal(events.length,40);assert.equal(new Set(events.map(e=>e.title)).size,40);assert.equal(new Set(events.map(e=>String(e._id))).size,40);
 for(const e of events){await new Event(e).validate();const c=selected.find(s=>String(s.church._id)===String(e.churchId)).church;svc.publishable(e,{...c,metadata:{...c.metadata,firstPublishedByAdminAt:now}},null);assert(e.description.includes('Publicación ficticia'));assert(e.endsAt>e.startsAt);assert(e.audience.length);assert(e.participationConditions.length>30);assert.equal(e.modality==='online',e.location===null);assert.equal(e.modality==='in_person',e.onlineUrl===null);}
 assert.equal(new Set(events.map(e=>e.modality)).size,3);assert.equal(new Set(events.map(e=>e.participation)).size,3);assert.equal(new Set(events.map(e=>e.category)).size,7);
});
test('Fechas conservan sábado adventista y retiros presenciales de ocho horas',()=>{
 const selected=selectChurches(churches()),events=build(selected,actor,now);
 for(const e of events){const g=selected.find(s=>String(s.church._id)===String(e.churchId)).group;if(g.key==='adventista')assert.equal(new Date(+e.startsAt-3*3600000).getUTCDay(),6);if(e.category==='retreat'){assert.equal(e.modality,'in_person');assert.equal((e.endsAt-e.startsAt)/3600000,8);}}
 assert.equal(events.filter(e=>svc.displayStatus(e,now)==='finished').length,4);assert.equal(events.filter(e=>svc.displayStatus(e,now)==='cancelled').length,4);
});
test('Colaboraciones se limitan a otras iglesias de la misma tradición',()=>{
 const selected=selectChurches(churches()),events=build(selected,actor,now),collaborations=events.filter(e=>e.collaborations.length);assert.equal(collaborations.length,5);
 for(const e of collaborations){const owner=selected.find(s=>String(s.church._id)===String(e.churchId)),partner=selected.find(s=>String(s.church._id)===String(e.collaborations[0].churchId));assert.equal(owner.group.key,partner.group.key);assert.notEqual(String(owner.church._id),String(partner.church._id));assert(e.collaborations[0].history.length>=1);}
 assert.equal(collaborations.filter(e=>e.collaborations[0].status==='accepted').length,3);
});
test('Selección fijada se reutiliza y no habilita iglesias ajenas al lote sintético',()=>{
 const a=churches(),selected=selectChurches(a),pinned=Object.fromEntries(groups.map(g=>[g.key,selected.filter(s=>s.group.key===g.key).map(s=>String(s.church._id))]));
 assert.deepEqual(selectChurches([...a].reverse(),pinned).map(s=>String(s.church._id)),selected.map(s=>String(s.church._id)));
 a[0].metadata.testData=false;assert.throws(()=>selectChurches(a,pinned));
});
