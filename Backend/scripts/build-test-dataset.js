// Construye archivos locales; no conecta a MongoDB ni publica fichas.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {planReview}=require('../src/services/review-consolidation.service');
const {church:churchSchema}=require('../src/validation/schemas');
const {musicalStyles,culturalStyles}=require('../src/validation/community-styles');
const ROOT=path.resolve(__dirname,'../..'),BATCH='synthetic-enrichment-2026-10-16-v2';
const BACKUP='Backend/.cache/import-backups/1790801843577-review.json',REVIEW='Backend/data/review-2026-09-30/consolidated.ndjson';
const OUT=path.join(ROOT,'outputs',BATCH),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const load=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const fields=['identification','location','christianIdentity','doctrine','meetings','meetingTypes','community','leadership','contact','firstVisit','privateFields','media'];
const empty=v=>v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length);
function leaves(value,prefix=''){
 if(value&&typeof value==='object'&&!Array.isArray(value))return Object.entries(value).flatMap(([k,v])=>leaves(v,prefix?prefix+'.'+k:k));
 return empty(value)?[]:[prefix];
}
function rebuild(){
 const original=JSON.parse(load(BACKUP)).churches,inventory=load(REVIEW).trim().split(/\r?\n/).map(JSON.parse);
 const excluded=new Set(inventory.filter(i=>i.decision==='excluded').map(i=>i.externalKey));
 const unwanted=original.filter(c=>excluded.has('google_maps:'+c.externalProfile?.placeId));
 const plans=planReview(inventory,original.filter(c=>!unwanted.includes(c))),rows=structuredClone(original);
 for(const p of plans){
  if(p.action==='insert')rows.push({...p.content,_id:'reconstructed-'+p.externalKeys[0],active:true,verification:{source:'google_maps',authorized:false}});
  if(p.action==='merge')Object.assign(rows.find(c=>String(c._id)===p.anchorId),p.content);
  for(const id of p.loserIds||[]){const row=rows.find(c=>String(c._id)===id);row.active=false;}
 }
 for(const row of rows)if(unwanted.some(c=>c._id===row._id))row.active=false;
 return {rows:rows.filter(c=>c.active!==false&&!c.mergedInto),summary:{backupDocuments:original.length,reconstructedDocuments:rows.length,active:rows.filter(c=>c.active!==false&&!c.mergedInto).length,manualReviewGroups:plans.filter(p=>p.action==='review').length}};
}
const identities=[['Católica','Católica Romana'],['Ortodoxa','Ortodoxa (escenario sintético)'],['Protestante','Bautista'],['Protestante','Luterana'],['Protestante','Metodista'],['Protestante','Presbiteriana'],['Protestante','Pentecostal'],['Protestante','Adventista'],['Protestante','Anglicana'],['Protestante','Asamblea de Dios'],['Rama Independiente','Evangélica'],['Rama Independiente','No Denominacional']];
const ministries=['Jóvenes','Niños','Matrimonios','Familias','Adultos mayores','Música / alabanza','Misiones','Evangelismo','Acción social','Ayuda comunitaria','Formación bíblica','Consejería','Deportes','Streaming','Oración'];
const activities=['Reuniones de Alabanza','Campamentos','Retiros','Evangelismo','Voluntariado','Ayuda social','Cursos / institutos','Conferencias','Eventos familiares','Actividades deportivas','Confraternidades','Obras Audiovisuales','Bautismos'];
const groups=['Niños','Adolescentes','Jóvenes','Adultos','Adultos mayores','Familias intergeneracionales'];
const tags=['Autoridad de las Escrituras','Sacramentos / ordenanzas','Bautismo infantil','Bautismo de creyentes','Santa Cena','Eucaristía','Predicación','Culto litúrgico','Culto contemporáneo','Prácticas carismáticas','Evangelización','Misiones','Formación bíblica'];
const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function nameIdentity(name){
 const n=fold(name),rules=[[/presbiter/,'Protestante','Presbiteriana'],[/metodista.*pentecostal|pentecostal.*metodista/,'Protestante','Pentecostal'],[/adventista|septimo dia/,'Protestante','Adventista'],[/bautista/,'Protestante','Bautista'],[/luteran/,'Protestante','Luterana'],[/anglican/,'Protestante','Anglicana'],[/asambleas? de dios/,'Protestante','Asamblea de Dios'],[/pentecostal/,'Protestante','Pentecostal'],[/metodista/,'Protestante','Metodista'],[/ortodox/,'Ortodoxa','Ortodoxa (tradición no especificada)'],[/catolica|parroquia|basilica/,'Católica','Católica Romana'],[/no denominacional|sin denominacion/,'Rama Independiente','No Denominacional']];
 for(const [pattern,branch,denomination]of rules)if(pattern.test(n))return {branch,denomination,rule:pattern.source};
 // No ubicar por azar entidades cuya identidad explícita no está en el catálogo base.
 if(/santos de los ultimos dias|morm[oó]n|jesucristo.*ultimos|testigos de jehova|nueva apostolica/.test(n))return {denomination:/testigos/.test(n)?'Testigos de Jehová':/nueva apostolica/.test(n)?'Nueva Apostólica':'Iglesia de Jesucristo de los Santos de los Últimos Días',rule:'explicit_name_outside_catalog'};
 return null;
}
function branchFor(denomination){
 const d=fold(denomination);
 if(d.includes('ortodox'))return 'Ortodoxa';
 if(d.includes('catolica'))return 'Católica';
 if(/bautista|luteran|metodista|presbiter|pentecostal|adventista|anglican|asamblea/.test(d))return 'Protestante';
 return null;
}
const activityByMinistry={'Jóvenes':['Campamentos','Retiros','Actividades deportivas'],'Niños':['Eventos familiares'],'Matrimonios':['Eventos familiares','Retiros'],'Familias':['Eventos familiares'],'Adultos mayores':['Confraternidades'],'Música / alabanza':['Reuniones de Alabanza'],'Misiones':['Evangelismo'],'Evangelismo':['Evangelismo'],'Acción social':['Voluntariado','Ayuda social'],'Ayuda comunitaria':['Ayuda social','Voluntariado'],'Formación bíblica':['Cursos / institutos','Conferencias'],'Consejería':['Conferencias'],'Deportes':['Actividades deportivas'],'Streaming':['Obras Audiovisuales'],'Oración':['Retiros','Confraternidades']};
function build(row,index){
 const key=row.externalProfile?.placeId||String(row._id),id=hash(BATCH+':'+key).slice(0,24),church={};
 for(const field of fields)if(row[field]!==undefined)church[field]=structuredClone(row[field]);
 // Fechas y cuentas del respaldo no se trasladan al conjunto de pruebas.
 const provenance=Object.fromEntries(leaves(church).map(p=>[p,{origin:'inherited_unverified',verified:false}]));
 const syntheticFields=[],inferredFields=[],enrichedFields=[],issues=[],u=n=>parseInt(hash(key+':'+n).slice(0,8),16),pick=(a,n)=>a[u(n)%a.length];
 const subset=(a,n,count)=>[...a].sort((x,y)=>hash(key+n+x).localeCompare(hash(key+n+y))).slice(0,count);
 const partial=index%5===0,knownOnly=index%10===0;
 function fill(p,value,origin='synthetic',basis){
  if(empty(value))return;
  const parts=p.split('.');let node=church;
  for(const k of parts.slice(0,-1))node=node[k]??={};
  const last=parts.at(-1);if(!empty(node[last]))return;
  node[last]=value;enrichedFields.push(p);(origin==='synthetic'?syntheticFields:inferredFields).push(p);provenance[p]={origin,verified:false,generator:BATCH,...(basis?{basis}:{})};
 }
 const clue=nameIdentity(row.identification.name),old=church.christianIdentity||{};
 if(clue?.denomination&&old.denomination&&fold(clue.denomination)!==fold(old.denomination))issues.push('existing_denomination_differs_from_name_hint');
 if(clue?.branch&&old.branch&&clue.branch!==old.branch)issues.push('existing_branch_differs_from_name_hint');
 if(!knownOnly){
  if(old.denomination){fill('christianIdentity.branch',branchFor(old.denomination),'existing_data_inference','christianIdentity.denomination');}
  else if(clue&&(!old.branch||!clue.branch||old.branch===clue.branch)){
   fill('christianIdentity.denomination',clue.denomination,'name_inference',clue.rule);
   fill('christianIdentity.branch',clue.branch,'name_inference',clue.rule);
  }
  else if(!clue){
   const options=old.branch?identities.filter(i=>i[0]===old.branch):identities;
   if(options.length){const identity=pick(options,'identity');fill('christianIdentity.branch',identity[0]);fill('christianIdentity.denomination',identity[1]);}
  }
  const denomination=church.christianIdentity?.denomination||'',branch=church.christianIdentity?.branch;
  const liturgical=branch==='Católica'||branch==='Ortodoxa',baptist=fold(denomination).includes('bautista'),adventist=fold(denomination).includes('adventista');
  const languageSets=[['Español'],['Español'],['Español'],['Español','Inglés'],['Español','Portugués'],['Español','Creole haitiano']];
  fill('christianIdentity.languages',pick(languageSets,'languages'));
  fill('community.ministries',subset(ministries,'ministries',1+u('minCount')%7));
  const selectedMinistries=church.community.ministries;
  const linkedActivities=[...new Set(selectedMinistries.flatMap(m=>activityByMinistry[m]||[]))];
  fill('community.activities',subset(linkedActivities.length?linkedActivities:activities,'activities',1+u('actCount')%5));
  const linkedGroups=selectedMinistries.flatMap(m=>({'Jóvenes':['Adolescentes','Jóvenes'],'Niños':['Niños'],'Familias':['Familias intergeneracionales'],'Matrimonios':['Adultos'],'Adultos mayores':['Adultos mayores']})[m]||[]);
  fill('community.targetGroups',[...new Set([...linkedGroups,...subset(groups,'groups',1+u('groupCount')%2)])]);
  fill('community.culturalStyle',pick(liturgical?culturalStyles.slice(0,3):culturalStyles,'culture'));
  const style=church.community.culturalStyle;
  const musicOptions=style==='Estilo Litúrgico'?musicalStyles.slice(0,2):style==='Estilo Conservador'?musicalStyles.slice(1,3):style==='Estilo Contemporáneo'?musicalStyles.slice(2):musicalStyles;
  fill('community.musicalStyles',subset(musicOptions,'music',1+u('musicCount')%2));
  if(!partial){
   fill('community.memberRange',pick(['0-50','50-100','100-200','200-300','300-500','500-1000','1000-2000','2000-5000'],'members'));
   // Perfiles sintéticos conservadores: excluir combinaciones doctrinales obvias incompatibles.
   const identityKnown=liturgical||branch==='Protestante'||branch==='Rama Independiente';
   const compatibleTags=liturgical?tags.filter(t=>!['Bautismo de creyentes','Culto contemporáneo','Prácticas carismáticas'].includes(t)):tags.filter(t=>!['Eucaristía','Bautismo infantil','Culto litúrgico',...(baptist||adventist?['Prácticas carismáticas']:[])].includes(t));
   if(identityKnown)fill('doctrine.characteristics',subset(compatibleTags,'doctrine',2+u('tagCount')%4));
   fill('location.parkingAvailability',pick(['yes','no','nearby','unknown'],'parking'));
   fill('location.accessibilityLevel',pick(['yes','no','partial','unknown'],'access'));
   fill('firstVisit.welcomeSupport',pick(['yes','no','partial','unknown'],'welcome'));
   const type=branch==='Católica'?'Misa':branch==='Ortodoxa'?'Divina liturgia':'Culto principal';
   const modality=pick(['Presencial','Presencial','Presencial','Híbrida'],'modality');
   const main={type,modality,frequency:'weekly',visitsEnabled:false,schedule:[{day:adventist?'Sábado':'Domingo',startTime:pick(['08:00','09:00','10:00','10:30','11:00','11:30','12:00','16:00','18:00','19:30'],'time'),durationMinutes:pick([45,60,75,90,120],'duration')}]};
   const extra=Array.from({length:u('meetingCount')%4},(_,i)=>({type:pick(selectedMinistries.includes('Jóvenes')?['Reunión de jóvenes','Estudio bíblico','Reunión de oración','Grupo pequeño / célula']:['Estudio bíblico','Reunión de oración','Grupo pequeño / célula'],'extraType'+i),modality:pick(['Presencial','Online','Híbrida'],'extraMode'+i),frequency:pick(['weekly','fortnightly','monthly'],'extraFreq'+i),visitsEnabled:false,schedule:[{day:pick(days.slice(0,5),'extraDay'+i),startTime:pick(['17:00','18:00','19:00','19:30','20:00'],'extraTime'+i),durationMinutes:pick([45,60,90],'extraDuration'+i)}]}));
   fill('meetings',[main,...extra]);
  }
 }
 church.verification={source:'synthetic_test_unverified',authorized:false};
 provenance.verification={origin:'test_control',verified:false};
 // Conserva el nombre original por trazabilidad; cualquier UI debe mostrar testOnly.
 churchSchema.parse(church);
 return {schemaVersion:'koinonia.test-fixture.v2',id,batchId:BATCH,testOnly:true,containsSynthetic:syntheticFields.length>0,scenario:knownOnly?'original_missing_data':partial?'partial_enrichment':'enriched',baseReference:{key,originalName:row.identification.name,source:'historical_etl_reconstruction',mapsUrl:row.externalProfile?.mapsUrl},enrichedFields,syntheticFields,inferredFields,issues,fieldProvenance:provenance,church};
}
function documentFor(f){
 const lines=['DOCUMENTO SINTÉTICO DE PRUEBA. NO ES EVIDENCIA INSTITUCIONAL.',`Ficha de prueba: ${f.id}. Lote: ${BATCH}.`,`Nombre heredado del ETL: ${f.church.identification.name}. Los atributos simulados NO afirman características reales de esta iglesia.`];
 for(const p of f.enrichedFields){const value=p.split('.').reduce((a,k)=>a[k],f.church);lines.push(`[${f.fieldProvenance[p].origin==='synthetic'?'SINTÉTICO':'INFERIDO'} NO VERIFICADO] ${p}: ${JSON.stringify(value)}.`);}
 if(!f.enrichedFields.length)lines.push('Sin enriquecimiento. Ficha de control con datos faltantes.');
 return {id:'doc-'+f.id,churchId:f.id,batchId:BATCH,testOnly:true,verified:false,kind:'synthetic_fixture',evidenceScope:'synthetic_test_only',text:lines.join('\n'),sourceFields:f.enrichedFields};
}
function main(){
 const {rows,summary}=rebuild();rows.sort((a,b)=>String(a.externalProfile?.placeId||a._id).localeCompare(String(b.externalProfile?.placeId||b._id)));
 const fixtures=rows.map(build),docs=fixtures.map(documentFor),coverage={};
 for(const f of fixtures)for(const p of leaves(f.church))coverage[p]=(coverage[p]||0)+1;
 const report={batchId:BATCH,testOnly:true,sourceFiles:[BACKUP,REVIEW],sourceHashes:{[BACKUP]:hash(load(BACKUP)),[REVIEW]:hash(load(REVIEW))},reconstruction:summary,records:fixtures.length,syntheticRecords:fixtures.filter(f=>f.containsSynthetic).length,syntheticValues:fixtures.reduce((n,f)=>n+f.syntheticFields.length,0),inferredValues:fixtures.reduce((n,f)=>n+f.inferredFields.length,0),nameInferredRecords:fixtures.filter(f=>Object.values(f.fieldProvenance).some(p=>p.origin==='name_inference')).length,issues:fixtures.filter(f=>f.issues.length).map(f=>({id:f.id,name:f.church.identification.name,issues:f.issues})),scenarios:Object.fromEntries(['enriched','partial_enrichment','original_missing_data'].map(s=>[s,fixtures.filter(f=>f.scenario===s).length])),coverage,limitations:['Reconstrucción histórica local, no consulta de la base actual.','No mide pertinencia real ni calidad de evidencia institucional.','Las inferencias por nombre o dato existente no están verificadas.','Distribución diseñada para cobertura técnica, no para representar prevalencias reales.','No se generan contactos, líderes, testimonios ni declaraciones oficiales.','El corpus permite probar recuperación; el sistema LLM/RAG no se integra con este script.']};
 fs.mkdirSync(OUT,{recursive:true});
 for(const [name,value]of [['churches.test.ndjson',fixtures],['rag.test.ndjson',docs]])fs.writeFileSync(path.join(OUT,name),value.map(v=>JSON.stringify(v)).join('\n')+'\n');
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({directory:OUT,...summary,records:report.records,syntheticRecords:report.syntheticRecords,syntheticValues:report.syntheticValues,scenarios:report.scenarios},null,2));
}
if(require.main===module)main();
module.exports={build,documentFor,rebuild,nameIdentity,branchFor,BATCH};
