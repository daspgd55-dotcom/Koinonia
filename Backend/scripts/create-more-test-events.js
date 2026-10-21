// Lote adicional: 40 eventos, 20 iglesias sintéticas, excluye Alma por ID y nombre.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseArgs}=require('node:util');
const mongoose=require('mongoose'),Event=require('../src/models/event.model'),Church=require('../src/models/church.model');
const validation=require('../src/validation/event'),svc=require('../src/services/event.service'),{visible}=require('../src/services/church.service');
const {DATABASE,configureDns,failureDetails}=require('./import-test-dataset'),{EJSON}=mongoose.mongo.BSON;
const ROOT=path.resolve(__dirname,'../..'),BATCH='test-events-multichurch-2026-10-21-v1',OUT=path.join(ROOT,'outputs',BATCH),ALMA='6ac9b9225017eda79d91466c';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const excluded=c=>String(c._id)===ALMA||fold(c.identification?.name).includes('alma');
const hash=v=>crypto.createHash('sha256').update(EJSON.stringify(v,{relaxed:false})).digest('hex');
const oid=s=>new mongoose.Types.ObjectId(hash(BATCH+':'+s).slice(0,24));
const theme=(title,category,description,audience=['Adultos','Familias intergeneracionales'])=>({title,category,description,audience});
const groups=[
 {key:'catolica',count:5,denomination:'Católica Romana',name:/^parroquia/i,themes:[
  theme('Escuchar el Evangelio en comunidad','gathering','Compartiremos una lectura orante del evangelio, un tiempo de silencio y una conversación guiada sobre cómo llevar el texto a la vida cotidiana. La acogida está abierta a vecinos y feligreses que deseen conocer la comunidad.'),
  theme('Una despensa que acompaña','community_service','Nos organizaremos para clasificar alimentos no perecibles y preparar bolsas de apoyo comunitario. El encuentro incluye orientación para un trato digno y un cierre de oración por las familias; no se divulgarán identidades de beneficiarios.'),
  theme('Pequeños pasos de catequesis en familia','workshop','Niños y adultos compartirán una actividad introductoria sobre la oración y los signos de la vida cristiana. Prepararemos una sencilla propuesta para continuar en casa. Este taller abierto no reemplaza ni acredita un proceso sacramental.', ['Niños','Familias intergeneracionales']),
  theme('Cantos y memoria de nuestra comunidad','cultural','Un encuentro para escuchar cantos de tradición católica y conocer las historias que la comunidad asocia a ellos. Alternaremos breves presentaciones, momentos de escucha y conversación; no es una audición ni exige conocimientos musicales.'),
  theme('Pausa para cuidar la vida interior','retreat','Reservaremos una jornada de recogimiento con lectura del evangelio, silencio personal y diálogo acompañado. Los espacios de reflexión serán voluntarios; nadie tendrá que compartir experiencias privadas ante el grupo.'),
  theme('Compañía para la tercera edad','community_service','Prepararemos materiales de lectura y tarjetas de saludo para personas mayores. Habrá una conversación sobre escucha respetuosa y una actividad de elaboración de mensajes, sin publicar datos ni imágenes de sus destinatarios.', ['Adultos','Adultos mayores']),
  theme('Aprender a leer las parábolas','workshop','Exploraremos dos parábolas, su contexto y las preguntas que proponen para la vida diaria. Se ofrecerá una guía breve para practicar en casa y un espacio de preguntas para personas sin formación previa.'),
  theme('Rosario y encuentro de vecinos','gathering','Nos reuniremos para rezar el rosario y conversar sobre las necesidades de nuestro entorno. Quienes no conozcan la práctica recibirán una guía de participación y podrán acompañar el encuentro en silencio.'),
  theme('Tarde de juegos y convivencia parroquial','other','Una jornada recreativa de juegos de mesa, desafíos cooperativos y conversación entre generaciones. Las actividades se adaptarán al ritmo de los participantes y cerrarán con un saludo de la comunidad.', ['Niños','Jóvenes','Familias intergeneracionales']),
  theme('Puertas abiertas: conoce tu parroquia','evangelism','Presentaremos la vida comunitaria, sus espacios de oración y las maneras de acercarse por primera vez. Habrá una reflexión sobre el evangelio y preguntas abiertas; participar no implica inscripción ni compromiso religioso.') ]},
 {key:'bautista',count:2,denomination:'Bautista',name:/^iglesia.*bautista/i,themes:[
  theme('Marcos en cuatro conversaciones','workshop','Un taller para observar el texto, comprender el contexto y formular aplicaciones personales a partir del Evangelio de Marcos. Practicaremos en grupos pequeños y compartiremos preguntas; no se requieren estudios teológicos.'),
  theme('Servir con las manos: útiles para estudiar','community_service','Prepararemos paquetes de útiles y materiales de lectura para una actividad de apoyo escolar. Trabajaremos por estaciones y cerraremos con una reflexión bíblica sobre el servicio. No se recibirán datos personales de beneficiarios.'),
  theme('Fe y preguntas: diálogo para jóvenes','gathering','Abriremos un espacio de conversación sobre dudas frecuentes al leer la Biblia y vivir la fe en la semana. El equipo moderará el diálogo para que todas las preguntas puedan plantearse con respeto, sin exigir intervenciones públicas.', ['Adolescentes','Jóvenes']),
  theme('Compartir esperanza con respeto','evangelism','Practicaremos cómo presentar el mensaje cristiano y escuchar a otras personas sin presionarlas. El taller incluye ejercicios de conversación, lectura bíblica y preparación de una actividad voluntaria en el entorno de la iglesia.') ]},
 {key:'presbiteriana',count:3,denomination:'Presbiteriana',name:/iglesia.*presbiter/i,themes:[
  theme('Salmos para la vida diaria','workshop','Leeremos salmos de gratitud, confianza y lamento para reconocer sus géneros y contexto. Cada participante podrá preparar una pequeña guía de lectura personal; habrá acompañamiento para quienes se acerquen por primera vez.'),
  theme('Conversaciones sobre gracia y comunidad','gathering','Compartiremos una reflexión bíblica sobre la gracia, la vida comunitaria y el cuidado mutuo. El encuentro combinará exposición breve, preguntas y oración, con libertad para escuchar sin intervenir.'),
  theme('Descanso y oración en los salmos','retreat','Dedicaremos una jornada a la lectura pausada de los salmos, el silencio y la oración. Habrá pausas de descanso y una conversación final para compartir aprendizajes de manera voluntaria.'),
  theme('Biblioteca compartida para el barrio','community_service','Organizaremos libros de lectura y material escolar para una biblioteca comunitaria de prueba. Aprenderemos criterios de clasificación, prepararemos fichas y conversaremos sobre el servicio a través de la educación.'),
  theme('Historia de la Reforma: preguntas y contexto','cultural','Una aproximación introductoria a la Reforma protestante y a la formación de comunidades presbiterianas. Se trabajará con una línea del tiempo y preguntas abiertas, sin exigir conocimientos previos ni convertir diferencias históricas en descalificaciones.'),
  theme('Lectura bíblica entre generaciones','workshop','Adultos y jóvenes leerán un mismo pasaje para comparar observaciones y aprender a escuchar perspectivas distintas. Cada equipo preparará una pregunta y una aplicación práctica para conversar durante la semana.', ['Jóvenes','Adultos','Adultos mayores']) ]},
 {key:'pentecostal',count:4,denomination:'Pentecostal',name:/^iglesia.*pentecostal/i,themes:[
  theme('Oración y esperanza para comenzar','gathering','Tendremos lectura bíblica, cantos congregacionales y tiempos de oración por necesidades de la comunidad. Se ofrecerá una bienvenida a visitantes y un espacio de conversación al finalizar, sin requerir testimonios públicos.'),
  theme('Jóvenes que sirven: una idea para el barrio','workshop','Diseñaremos pequeñas acciones de ayuda que puedan realizarse en equipo con recursos sencillos. La jornada combina una reflexión sobre el servicio, trabajo por grupos y presentación de propuestas.', ['Adolescentes','Jóvenes']),
  theme('Cantos de gratitud y testimonio','cultural','El encuentro alternará música cristiana y lecturas bíblicas sobre la gratitud. Los asistentes podrán escuchar o sumarse a los cantos; no se solicitarán relatos personales ni se registrarán testimonios sin consentimiento.'),
  theme('Acompañar sin invadir: taller de escucha','workshop','Practicaremos escucha atenta, límites y formas respetuosas de acompañar situaciones difíciles. Se utilizarán ejemplos ficticios y pautas de derivación; el taller no sustituye atención profesional ni exige compartir experiencias privadas.'),
  theme('Sembrar esperanza en el entorno','evangelism','Prepararemos una presentación breve del mensaje cristiano y ejercicios de diálogo con respeto a la decisión de cada persona. El encuentro comienza y termina en la iglesia; cualquier participación en el barrio será voluntaria.'),
  theme('Familias que conversan y juegan','other','Compartiremos juegos cooperativos y conversaciones guiadas para fortalecer la convivencia familiar. Habrá propuestas sencillas para continuar en casa y una reflexión bíblica de cierre.', ['Niños','Familias intergeneracionales']),
  theme('Una pausa para orar y descansar','retreat','Una jornada de lectura bíblica, oración y descanso con espacios personales y momentos comunitarios. La participación en conversaciones grupales será voluntaria y no se ofrecerán promesas de resultados personales o de salud.'),
  theme('Abrigo y cuidado para nuestros vecinos','community_service','Clasificaremos prendas limpias y en buen estado para preparar conjuntos de ayuda. Se explicarán criterios de recepción y entrega respetuosa, evitando fotografías o exposición de quienes reciban los aportes.') ]},
 {key:'adventista',count:3,denomination:'Adventista',name:/^iglesia.*adventista/i,themes:[
  theme('Sábado de estudio: fe y vida cotidiana','workshop','Compartiremos el estudio de un pasaje bíblico, preguntas en grupos pequeños y una aplicación para la semana. El encuentro está abierto a visitantes que quieran conocer una dinámica de estudio de la comunidad.'),
  theme('Caminar juntos: hábitos de bienestar','workshop','Conversaremos sobre descanso, movimiento cotidiano y organización de rutinas desde una mirada comunitaria. Habrá ejercicios suaves opcionales; la actividad es educativa y no ofrece diagnóstico, tratamiento ni recomendaciones médicas individuales.'),
  theme('Un sábado para agradecer en familia','gathering','Nos reuniremos para una lectura bíblica sobre gratitud, cantos y una actividad participativa entre generaciones. Las familias visitantes recibirán una orientación sencilla para integrarse sin preparación previa.', ['Niños','Familias intergeneracionales']),
  theme('Lectura acompañada para nuevos visitantes','workshop','Practicaremos la observación de un texto bíblico y compartiremos herramientas para continuar leyendo en casa. Cada participante podrá hacer preguntas o simplemente escuchar; no se exige pertenecer a la comunidad.'),
  theme('Sábado de solidaridad: manos disponibles','community_service','Prepararemos materiales para una acción comunitaria y conversaremos sobre el cuidado de las personas. Trabajaremos en equipos con tareas accesibles para distintos ritmos, sin publicar datos ni imágenes de beneficiarios.'),
  theme('Música y esperanza al terminar el sábado','cultural','Un encuentro de cantos, lecturas y gratitud para cerrar el sábado en comunidad. Alternaremos momentos de escucha con participación congregacional y un saludo para quienes nos visitan por primera vez.') ]},
 {key:'metodista',count:1,denomination:'Metodista',name:/^iglesia.*metodista(?!.*pentecostal)/i,themes:[
  theme('Fe que se expresa en servicio','community_service','Prepararemos una acción de ayuda práctica y reflexionaremos sobre el vínculo entre fe, cuidado y vida cotidiana. El trabajo por estaciones permitirá colaborar con distintas habilidades, sin que aportar materiales sea un requisito.'),
  theme('Himnos y memoria de la comunidad metodista','cultural','Escucharemos himnos y conoceremos el lugar del canto en la vida comunitaria metodista. Habrá breves introducciones históricas, lectura de textos y participación voluntaria en los cantos.') ]},
 {key:'anglicana',count:1,denomination:'Anglicana',name:/iglesia.*anglicana/i,themes:[
  theme('Oración y lectura para el camino diario','gathering','Presentaremos una forma sencilla de oración comunitaria con lecturas bíblicas, silencio e intercesiones. Quienes se acerquen por primera vez recibirán indicaciones para seguir el encuentro sin conocer previamente la liturgia.'),
  theme('Hospitalidad: recibir a quien llega','workshop','Conversaremos sobre la acogida a visitantes, la claridad de las indicaciones y el acompañamiento respetuoso. Se trabajará con situaciones ficticias y propuestas para mejorar la bienvenida, sin registrar información personal de asistentes.') ]},
 {key:'asamblea',count:1,denomination:'Asamblea de Dios',name:/^iglesia.*asambleas? de dios/i,themes:[
  theme('Encuentro de oración y alabanza compartida','gathering','Tendremos música congregacional, lectura bíblica y oración en comunidad. El equipo de bienvenida orientará a las personas nuevas y se ofrecerá un momento de conversación al terminar, sin obligación de participar en voz alta.'),
  theme('Familias en misión: servir con lo que tenemos','evangelism','Exploraremos maneras sencillas de compartir la fe y ayudar a nuestro entorno como familias. Habrá una reflexión bíblica, actividades por equipos y preparación de propuestas que respeten las decisiones y la privacidad de otras personas.', ['Jóvenes','Adultos','Familias intergeneracionales']) ]}
];
function selectChurches(churches,pinned){
 const selected=[],used=new Set(),names=new Set();
 for(const group of groups){
  const candidates=churches.filter(c=>!excluded(c)&&c.metadata?.testData&&c.active&&['published','verified'].includes(c.metadata?.dataStatus)&&group.name.test(c.identification.name)&&c.christianIdentity?.denomination===group.denomination&&c.location?.address&&c.location?.commune&&!/corp\b|asociacion|convencion|conferencia|edificio|sede |board/i.test(fold(c.identification.name)));
  candidates.sort((a,b)=>fold(a.identification.name).localeCompare(fold(b.identification.name))||String(a._id).localeCompare(String(b._id)));
  const choices=pinned?group.key in pinned?pinned[group.key].map(id=>candidates.find(c=>String(c._id)===id)):[]:candidates;
  let count=0;
  for(const church of choices){if(!church)throw Error('Una iglesia fijada al lote ya no es elegible');const name=fold(church.identification.name);if(used.has(String(church._id))||names.has(name))continue;selected.push({group,church,slot:count});used.add(String(church._id));names.add(name);if(++count===group.count)break;}
  if(count!==group.count)throw Error('No hay suficientes iglesias locales coherentes para '+group.key+' ('+count+'/'+group.count+')');
 }
 return selected;
}
function schedule(index,group){
 const past=index<4,day=past?new Date('2026-10-20T00:00:00Z'):new Date(Date.UTC(2026,9,22+index-4));
 if(group==='adventista'){while(day.getUTCDay()!==6)day.setUTCDate(day.getUTCDate()+1);}
 const date=day.toISOString().slice(0,10),hour=[10,16,18,19,11][index%5],duration=index%9===0?3:index%4===0?2:1;
 return {startsAt:date+'T'+String(hour).padStart(2,'0')+':00:00-03:00',endsAt:date+'T'+String(hour+duration).padStart(2,'0')+':00:00-03:00'};
}
function build(selected,actor,now){
 const events=[];
 for(const [churchIndex,{group,church,slot}]of selected.entries())for(let j=0;j<2;j++){
  const index=churchIndex*2+j,t=group.themes[slot*2+j],time=schedule(index,group.key),modality=t.category==='retreat'?'in_person':index%5===0?'online':index%5===1?'hybrid':'in_person',participation=index%10===9?'invitation':[2,4,6].includes(index%10)?'registration':'free';
  if(t.category==='retreat'){const day=time.startsAt.slice(0,10);time.startsAt=day+'T09:00:00-03:00';time.endsAt=day+'T17:00:00-03:00';}
  const location=modality==='online'?null:Object.fromEntries(['address','commune','city','region','countryCode','coordinates'].filter(k=>church.location[k]!==undefined).map(k=>[k,church.location[k]]));
  const tag=String(index+1).padStart(2,'0'),closed=index>=36;
  let conditions=participation==='invitation'?'Participación por invitación del equipo organizador. Confirma previamente tu asistencia; no se recibirán pagos ni se reservarán cupos desde Koinonía.':participation==='registration'?'Actividad gratuita con inscripción previa para preparar materiales. Indica al equipo cualquier adaptación que necesites; no se exige aportar donaciones.':'Entrada liberada, sin inscripción ni aportes obligatorios. Puedes participar aunque sea tu primera visita.';
  if(t.audience.some(x=>['Niños','Adolescentes','Familias intergeneracionales'].includes(x)))conditions+=' Los menores deben asistir con una persona adulta responsable.';
  if(group.key==='adventista')conditions+=' La actividad se realiza en sábado.';
  if(closed)conditions='Evento cancelado. No acudas en la fecha anunciada; no existe por ahora una fecha de reemplazo.';
  const image=index%3===0?church.media?.find(m=>m.type==='image'&&/^https?:\/\//.test(m.url)&&m.url.length<=2000):null;
  const body=validation.create.parse({churchId:String(church._id),title:t.title,category:t.category,description:`${church.identification.name} invita a este encuentro. ${t.description}\n\n${modality==='online'?'La actividad será completamente en línea. No necesitas desplazarte a la sede.':modality==='hybrid'?'Puedes asistir a la sede indicada o participar a distancia. La bienvenida y las preguntas estarán disponibles en ambas modalidades.':'Nos encontraremos en la sede indicada de la iglesia; consulta al equipo de acogida al llegar.'} ${closed?'Esta fecha fue cancelada por necesidades de reorganización; conservamos la ficha para informar a quienes la habían consultado.':''}\n\nPublicación ficticia para pruebas de Koinonía. No corresponde a una convocatoria real.`,...time,modality,venue:modality==='online'?'Sala virtual de la comunidad':t.category==='retreat'?'Jornada de retiro en la sede de la iglesia':'Sede de '+church.identification.name,location,onlineUrl:modality==='in_person'?null:'https://reuniones.koinonia.test/evento-'+tag,audience:t.audience,cover:image?{url:image.url,source:'synthetic_test_inherited_church_image',title:'Imagen de la sede heredada de la ficha de prueba',frame:index%2?'wide':'landscape',focalX:50,focalY:50}:null,participation,participationConditions:conditions,registrationInstructions:participation==='free'?'':participation==='invitation'?'Confirma con el equipo organizador que te hizo llegar la invitación, antes de la fecha del encuentro.':index%2?'Inscríbete presencialmente con el equipo de acogida de la iglesia antes del encuentro.':'Utiliza el formulario indicado para registrar tu interés. El formulario es simulado en este entorno de pruebas.',registrationUrl:participation==='registration'&&index%2===0?'https://inscripciones.koinonia.test/evento-'+tag:null,contact:{email:'evento'+tag+'@koinonia.test'},privateFields:{email:index%6===0,phone:true},openCollaboration:index%7===0});
  const doc=new Event({...body,_id:oid(tag),effectiveEndsAt:svc.effectiveEnd(body.startsAt,body.endsAt),publicationStatus:'published',eventStatus:closed?'cancelled':'scheduled',cancellationReason:closed?'El equipo organizador necesita reorganizar el espacio y los recursos de acogida. Se cancela esta fecha; una nueva convocatoria se anunciará por separado.':'',createdBy:actor._id,updatedBy:actor._id,createdAt:now,updatedAt:now,version:closed?2:1}).toObject();
  if(closed)doc.participationChanges=[{_id:oid(tag+'-cancel'),version:2,at:now,kind:'cancelled'}];
  events.push(doc);
 }
 // Misma tradición; un único propietario y contraparte, con historial expresamente simulado.
 for(const [eventIndex,partnerIndex,status]of [[10,6,'accepted'],[14,8,'accepted'],[20,11,'pending'],[28,15,'accepted'],[30,16,'pending']]){
  const event=events[eventIndex],partner=selected[partnerIndex].church,invite=oid(eventIndex+'-invite');
  const at=new Date(Math.min(+now-120000,+event.startsAt-86400000));
  const history=[{_id:invite,action:'invite',actor:actor._id,actorName:actor.name,actorRole:actor.role,at,audienceChurchId:partner._id}];
  if(status==='accepted')history.push({_id:oid(eventIndex+'-accept'),action:'accept',actor:actor._id,actorName:actor.name,actorRole:actor.role,at:new Date(+at+60000),audienceChurchId:event.churchId});
  event.collaborations=[{_id:oid(eventIndex+'-relation'),churchId:partner._id,status,invitationNoticeId:invite,history}];event.version=status==='accepted'?3:2;
  if(status==='accepted')event.description=event.description.replace('\n\nPublicación ficticia',`\n\nColabora en este escenario: ${partner.identification.name}. La organización y coordinación general corresponden a la iglesia convocante.\n\nPublicación ficticia`);
 }
 return events;
}
async function main(){
 const {values:v}=parseArgs({options:{apply:{type:'boolean',default:false},'dns-server':{type:'string'}}});configureDns(v['dns-server']);
 await mongoose.connect(process.env.MONGO_URI,{dbName:DATABASE,serverSelectionTimeoutMS:10000,autoIndex:false,autoCreate:false});
 const db=mongoose.connection.db;if(db.databaseName!==DATABASE)throw Error('Destino incorrecto');
 const actor=await db.collection('users').findOne({role:'admin',active:true});if(!actor)throw Error('Se requiere un administrador de pruebas activo');
 const manifest=await db.collection('test_batches').findOne({_id:BATCH}),churches=await Church.find({...visible,'metadata.testData':true}).lean(),selected=selectChurches(churches,manifest?.selection),now=new Date();
 const events=build(selected,actor,now),approvals=selected.filter(s=>!s.church.metadata.firstPublishedByAdminAt),selection=Object.fromEntries(groups.map(g=>[g.key,selected.filter(s=>s.group.key===g.key).map(s=>String(s.church._id))]));
 for(const event of events){await new Event(event).validate();const source=selected.find(s=>String(s.church._id)===String(event.churchId)).church;svc.publishable(event,{...source,metadata:{...source.metadata,firstPublishedByAdminAt:source.metadata.firstPublishedByAdminAt||now}},null);}
 const ids=events.map(e=>e._id),existing=await Event.find({_id:{$in:ids}}).lean();
 if(existing.length&&(!manifest||existing.some(e=>!selected.some(s=>String(s.church._id)===String(e.churchId)))))throw Error('Colisión con eventos ajenos al lote');
 fs.mkdirSync(OUT,{recursive:true});
 const summary={batchId:BATCH,database:DATABASE,events:events.length,churches:selected.length,excludedChurch:'Iglesia Bíblica Alma',approvalsNeeded:approvals.length,selection:selected.map(s=>({id:String(s.church._id),name:s.church.identification.name,tradition:s.group.key,events:2})),modalities:count(events,e=>e.modality),participation:count(events,e=>e.participation),categories:count(events,e=>e.category),states:count(events,e=>svc.displayStatus(e,now))};
 fs.writeFileSync(path.join(OUT,'plan.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({mode:v.apply?'apply':'plan',...summary}));if(!v.apply)return;
 const otherBefore=await Event.find({_id:{$nin:ids}}).sort({_id:1}).lean(),backup=path.join(ROOT,'Backend/.cache/test-event-backups',Date.now()+'-multichurch.ejson');fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,EJSON.stringify({batchId:BATCH,churches:selected.map(s=>s.church),existingEvents:existing,previousManifest:manifest},{relaxed:false}));
 if(!(await db.listCollections({name:'events'}).toArray()).length)await db.createCollection('events');
 const session=await mongoose.startSession();let inserted=0;
 try{await session.withTransaction(async()=>{
  if(!await db.collection('users').findOne({_id:actor._id,role:'admin',active:true},{session}))throw Error('El actor dejó de estar autorizado');
  for(const s of selected){const current=await db.collection('churches').findOne({_id:s.church._id},{session});if(!current||hash(current)!==hash(s.church)||excluded(current)||!current.metadata?.testData)throw Error('Una iglesia cambió durante la preparación; reintenta');}
  for(const {church}of approvals){const result=await db.collection('churches').updateOne({_id:church._id,'metadata.testData':true},{$set:{'metadata.firstPublishedByAdminAt':now,updatedBy:actor._id,updatedAt:now},$inc:{'metadata.version':1}},{session});if(result.modifiedCount!==1)throw Error('Falló la habilitación simulada');}
  const result=await db.collection('events').bulkWrite(events.map(e=>({updateOne:{filter:{_id:e._id},update:{$setOnInsert:e},upsert:true}})),{session});inserted=result.upsertedCount;
  await db.collection('test_batches').updateOne({_id:BATCH},{$setOnInsert:{testOnly:true,kind:'events',createdAt:now,eventIds:ids,selection,simulatedCollaborationHistory:true,simulatedPublicationApprovals:approvals.map(s=>s.church._id),actor:actor._id,backup}},{upsert:true,session});
 });}finally{await session.endSession();}
 const actual=await Event.find({_id:{$in:ids}}).lean(),publicRows=await Event.aggregate([{$match:{_id:{$in:ids}}},...svc.publicStages()]);
 if(actual.length!==40||publicRows.length!==40||new Set(actual.map(e=>String(e.churchId))).size!==20||actual.some(e=>String(e.churchId)===ALMA))throw Error('La verificación pública del lote falló');
 let directory;await require('../src/controllers/event.controller').list({query:{view:'all',limit:100}},{set(){return this;},json(data){directory=data;}});
 const directoryIds=new Set(directory.data.map(e=>String(e._id))),listed=actual.filter(e=>directoryIds.has(String(e._id))).length;
 // Los pasados dejan el directorio a las 72 h; el detalle/historial permanecen.
 const recentCount=actual.filter(e=>+e.effectiveEndsAt>=Date.now()-3*86400000).length;
 if(listed!==recentCount)throw Error('El directorio público no incluye los eventos esperados según su ventana temporal');
 for(const e of publicRows){const accepted=e.collaborations.filter(c=>c.status==='accepted');if(e.collaboratorDocs.length!==accepted.length)throw Error('Visibilidad de colaboración incorrecta');}
 const otherAfter=await Event.find({_id:{$nin:ids}}).sort({_id:1}).lean();if(hash(otherBefore)!==hash(otherAfter))throw Error('Cambió un evento fuera del lote durante la ejecución; revisar concurrencia');
 const report={...summary,inserted,approvalsPerformed:approvals.length,publiclyVisible:publicRows.length,listedInDirectory:listed,otherEventsUntouched:true,otherEvents:otherAfter.length,totalEvents:await Event.countDocuments(),verifiedAt:new Date(),backup,events:actual.map(e=>({id:String(e._id),title:e.title,church:selected.find(s=>String(s.church._id)===String(e.churchId)).church.identification.name,startsAt:e.startsAt,endsAt:e.endsAt,modality:e.modality,participation:e.participation,category:e.category,status:svc.displayStatus(e),collaborations:e.collaborations.map(c=>({churchId:String(c.churchId),status:c.status}))}))};
 fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(OUT,'events.json'),JSON.stringify(actual,null,2)+'\n');
 console.log(JSON.stringify({status:'ready',inserted,churches:20,publiclyVisible:40,listedInDirectory:listed,otherEvents:otherAfter.length,totalEvents:report.totalEvents,otherEventsUntouched:true,report:path.join(OUT,'verification.json')}));
}
function count(events,key){return events.reduce((a,e)=>(a[key(e)]=(a[key(e)]||0)+1,a),{});}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify(failureDetails(e)));process.exitCode=1;}).finally(()=>mongoose.disconnect());
module.exports={groups,selectChurches,build,schedule,excluded};
