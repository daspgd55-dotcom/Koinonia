// Edita aquí asuntos, títulos, párrafos y botones. ${...} inserta datos de la invitación.
const roles = {
 administrator: {name:'Representante administrador', scope:'Puedes gestionar la ficha de la iglesia, sus comunidades vinculadas y eventos, las experiencias, las visitas y el equipo.'},
 editor: {name:'Editor', scope:'Puedes editar comunidades vinculadas y eventos. La edición de la ficha principal y la gestión de visitas corresponden a otras funciones.'},
 moderator: {name:'Moderador', scope:'Puedes moderar experiencias y gestionar visitas.'},
 welcome: {name:'Bienvenida', scope:'Puedes gestionar visitas y acompañar a quienes desean conocer la iglesia.'}
};
const sources = {institutional_website:'el sitio institucional de la iglesia',institutional_social:'una red social institucional de la iglesia',direct_contact:'un contacto directo registrado por Koinonía',administrative_record:'los antecedentes de contacto registrados por Koinonía'};
const invitationHelp = 'Este enlace es personal para el correo que recibió la invitación. Para informar una iglesia incorrecta, rechazar la invitación o pedir que dejemos de contactar este correo por esta iglesia, abre el enlace, pulsa «Comenzar» y usa la sección de problemas. Si el enlace venció, contacta al equipo por el canal que te hizo llegar la invitación.';
const memberHelp = 'Usa una cuenta del correo que recibió esta invitación. Si tienes otra sesión abierta, pulsa «Cambiar de cuenta para esta invitación». Puedes rechazar la asignación desde la misma página. Si el enlace venció, solicita uno nuevo al administrador.';

function initial({name,source}) {
 return {
  subject:`Una invitación para ${name} · Koinonía`, preheader:'Ayuda a las personas a conocer tu iglesia con información actualizada.',
  eyebrow:'INVITACIÓN A TU IGLESIA', title:'Ayudemos a las personas a encontrarse.',
  paragraphs:[
   'Hola, equipo de la iglesia. Somos Koinonía, una iniciativa personal que busca facilitar el encuentro entre personas, iglesias y comunidades cristianas.',
   `${name} ya tiene una ficha en nuestra plataforma. Queremos invitarles a revisarla y completarla con información que la propia iglesia pueda confirmar.`,
   `Obtuvimos este correo desde ${sources[source]||'un contacto institucional registrado'}. Si corresponde a otra persona, puedes informarlo desde la invitación.`
  ],
  sectionTitle:'¿Cómo pueden colaborar?', sectionText:'Revisando la ubicación, los horarios de reunión, los datos de contacto, las actividades y las condiciones de accesibilidad. Así, quienes busquen una iglesia podrán conocerla mejor antes de visitarla.',
  steps:['Reconoce la iglesia que aparece en la invitación.','Propón a las personas que colaborarán y sus funciones.','Envía la propuesta para que la administración de Koinonía la revise.'],
  note:'Puedes coordinar la respuesta sin formar parte del equipo. Si la iglesia aún no tiene administrador, incluye una persona con la función Representante administrador. Después de la aprobación, esa persona deberá aceptar primero.',
  cta:'Conocer la invitación', help:invitationHelp
 };
}
function clarification({name,clarification}) {
 return {
  subject:`Una aclaración sobre la propuesta de ${name} · Koinonía`, preheader:'Tu respuesta nos ayudará a continuar con la revisión.',
  eyebrow:'REVISIÓN DE LA PROPUESTA', title:'Necesitamos un poco más de información.',
  paragraphs:[`Gracias por colaborar con ${name}. Al revisar la propuesta encontramos un punto que necesitamos aclarar antes de continuar.`],
  sectionTitle:'Mensaje de la administración', sectionText:clarification||'Revisa la aclaración disponible al abrir tu invitación.',
  note:'Abre el enlace para leer la solicitud y presentar la información actualizada. La asignación de funciones continúa sujeta a revisión.',
  cta:'Responder la aclaración', help:invitationHelp
 };
}
function member({name,role}) {
 const assigned=roles[role];
 if(!assigned)throw Error('Función de representante desconocida');
 return {
  subject:`Te invitaron al equipo de ${name} · Koinonía`, preheader:`Tu función propuesta ya fue aprobada. Revisa y acepta tu participación como ${assigned.name.toLowerCase()}.`,
  eyebrow:'INVITACIÓN PERSONAL AL EQUIPO', title:'Tu colaboración tiene un lugar.',
  paragraphs:[`La administración de Koinonía aprobó tu incorporación al equipo de ${name}. Te invitamos a revisar la función y decidir si quieres asumirla.`],
  sectionTitle:assigned.name, sectionText:assigned.scope,
  steps:['Abre tu invitación personal.','Inicia sesión o crea una cuenta con este mismo correo.','Acepta la participación y vuelve a iniciar sesión para cargar tus permisos.'],
  note:role==='administrator'?'Si la iglesia está formando su primer equipo, acepta tu invitación primero para que los demás representantes puedan incorporarse.':'Si la iglesia todavía no tiene un administrador activo, esa persona debe aceptar primero. Después podrás continuar con este mismo enlace.',
  cta:'Revisar y aceptar mi participación', help:memberHelp
 };
}
function activated({name,role}) {
 const assigned=roles[role];
 if(!assigned)throw Error('Función de representante desconocida');
 return {
  subject:`Tu acceso a ${name} está activo · Koinonía`, preheader:`Ya puedes colaborar como ${assigned.name.toLowerCase()}.`,
  eyebrow:'PARTICIPACIÓN CONFIRMADA', title:'Gracias por sumarte al equipo.',
  paragraphs:[`Aceptaste tu participación en ${name}. Tu cuenta ya está vinculada a esta iglesia con la función indicada a continuación.`],
  sectionTitle:assigned.name, sectionText:assigned.scope,
  note:'Inicia sesión nuevamente para cargar tus permisos. Si tu cuenta utiliza verificación de correo o segundo factor, completa esos pasos. Los permisos de visitas también pueden depender de los encargados que haya elegido la iglesia.',
  cta:'Entrar a la administración', help:'Conserva tus credenciales de forma personal. Para consultar un cambio de función, contacta a la administración de tu iglesia o al equipo de Koinonía.'
 };
}
// Preparadas para futuras notificaciones al contacto inicial. No activan nuevos envíos.
const updates = {
 received: ({name})=>({subject:`Recibimos la propuesta de ${name} · Koinonía`,preheader:'La propuesta está disponible para revisión.',eyebrow:'PROPUESTA RECIBIDA',title:'Gracias por compartir tu propuesta.',paragraphs:[`Registramos la propuesta del equipo de ${name}. La administración de Koinonía revisará las personas y funciones indicadas. Si se necesita una aclaración, podrá solicitarla por este canal.`],note:'Cada persona aprobada recibirá una invitación individual cuando la administración confirme su envío. El acceso se activa al aceptar esa invitación.'}),
 approved: ({name})=>({subject:`La revisión del equipo de ${name} está lista · Koinonía`,preheader:'La administración terminó de revisar la propuesta.',eyebrow:'PROPUESTA REVISADA',title:'El equipo puede dar el siguiente paso.',paragraphs:[`La administración de Koinonía terminó de revisar la propuesta de ${name}. Las personas aprobadas podrán aceptar su participación mediante una invitación individual, una vez que se confirme el envío de esos correos.`],note:'En equipos nuevos, la persona administradora debe aceptar primero. Quien coordinó esta respuesta puede seguir colaborando sin asumir una función en el equipo.'}),
 rejected: ({name})=>({subject:`Resultado de la propuesta de ${name} · Koinonía`,preheader:'La revisión de esta propuesta ha finalizado.',eyebrow:'RESULTADO DE LA REVISIÓN',title:'Gracias por tu disposición a colaborar.',paragraphs:[`La administración de Koinonía decidió no aprobar esta propuesta para ${name}. Si necesitas conocer el motivo o corregir los antecedentes, contacta al equipo por el canal que te hizo llegar la invitación.`]})
};
function content(stage,data) {
 if(stage==='institutional-reminder')return {...initial(data),subject:`Tu invitación a colaborar con ${data.name} sigue pendiente · Koinonía`,preheader:'Puedes responder, declinar o informar un problema desde tu enlace personal.',eyebrow:'RECORDATORIO DE INVITACIÓN',title:'¿Pudieron revisar la invitación?',paragraphs:[`Hace un tiempo invitamos a ${data.name} a colaborar en la actualización de su ficha. Aún esperamos una respuesta y te compartimos el acceso para que puedan revisarlo cuando les resulte conveniente.`]};
 if(stage==='member-reminder')return {...member(data),subject:`Tu participación en ${data.name} espera tu respuesta · Koinonía`,preheader:'Revisa tu función y decide si quieres incorporarte.',eyebrow:'RECORDATORIO PERSONAL',title:'Tu invitación sigue pendiente.'};
 const factory={initial,clarification,member,activated,...updates}[stage];
 if(!factory)throw Error('Plantilla de invitación desconocida');
 return factory(data);
}
module.exports={content};
