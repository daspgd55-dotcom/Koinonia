const has=v=>Array.isArray(v)?v.length>0:typeof v==='string'?v.trim().length>0:!!v;
function checklist(c){
 c=c.toObject?c.toObject():c;
 const item=(key,label,value,required=false)=>({key,label,complete:has(value),required});
 const sections=[
 ['Identificación',[item('name','Nombre',c.identification?.name,true),item('description','Descripción',c.identification?.description)]],
 ['Ubicación',[item('commune','Comuna',c.location?.commune,true),item('address','Dirección',c.location?.address,true),item('coordinates','Ubicación en mapa',c.location?.coordinates?.coordinates?.length===2,true)]],
 ['Identidad cristiana',[item('denomination','Denominación',c.christianIdentity?.denomination,true),item('branch','Rama',c.christianIdentity?.branch),item('languages','Idiomas',c.christianIdentity?.languages)]],
 ['Doctrina',[item('doctrine','Declaración de creencias',c.doctrine?.officialStatement,true),item('characteristics','Creencias y prácticas',c.doctrine?.characteristics)]],
 ['Reuniones',[item('meetings','Tipos de reuniones',c.meetings?.length||c.meetingTypes?.length,true),item('schedule','Horarios de reuniones',c.meetings?.some(m=>m.schedule?.some(s=>s.day&&s.startTime)))]],
 ['Comunidad',[item('activities','Actividades',c.community?.activities),item('ministries','Ministerios',c.community?.ministries),item('targetGroups','Públicos',c.community?.targetGroups)]],
 ['Liderazgo y contacto',[item('leader','Representante principal',c.leadership?.mainLeader?.name,true),item('contact','Canal oficial',Object.values(c.contact||{}).some(has))]],
 ['Primera visita',[item('instructions','Indicaciones de bienvenida',c.firstVisit?.instructions)]],
 ['Validación y multimedia',[item('source','Fuente interna',c.verification?.source,true),item('authorized','Autorización',c.verification?.authorized,true),item('media','Recurso multimedia',c.media?.some(m=>m.url))]]
 ].map(([title,items])=>({title,items,completed:items.filter(x=>x.complete).length,total:items.length}));
 const items=sections.flatMap(s=>s.items),missing=items.filter(x=>x.required&&!x.complete);
 return {sections,missing,ready:!missing.length,percent:Math.round(100*items.filter(x=>x.complete).length/items.length)};
}
function quality(c,now=new Date()){
 // Solo atributos públicos; ninguna bonificación por revelar datos privados.
 const groups=[c.identification?.description,c.location?.address,c.christianIdentity?.denomination,c.doctrine?.officialStatement,c.meetings?.some(m=>m.schedule?.length),c.community?.activities?.length||c.community?.ministries?.length,c.leadership?.mainLeader?.name,c.media?.length];
 const completeness=groups.filter(has).length/groups.length,verified=c.metadata?.dataStatus==='verified'?1:0;
 const date=c.verification?.lastUpdated,age=date?(now-new Date(date))/86400000:NaN;
 const freshness=Number.isFinite(age)&&age>=0?(age<=180?1:age<=365?.5:0):0;
 return {completeness,verified,freshness,score:.6*completeness+.25*verified+.15*freshness};
}
module.exports={checklist,quality};
