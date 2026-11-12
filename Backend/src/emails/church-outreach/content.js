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
const institutionalHelp='El enlace es personal para el correo que recibió la invitación. Desde la página puedes revisar la iglesia, responder, informar que el contacto o la iglesia son incorrectos, o pedir que no volvamos a escribir a esta dirección por esta iglesia. Si venció, solicita a Koinonía que revise el caso.';

function initial({name,source}) {
 return {
  subject:`Invitación para que ${name} participe en Koinonía`, preheader:'Estamos preparando un piloto para ayudar a las personas a conocer iglesias y comunidades cristianas.',
  eyebrow:'INVITACIÓN A TU IGLESIA', title:`Una invitación para ${name}`,
  signature:'Koinonía',
  paragraphs:[
   'Hola, equipo de la iglesia:',
   'Soy David, creador de Koinonía. Estoy desarrollando una plataforma para que las personas puedan conocer iglesias y comunidades cristianas, explorar información y acercarse a una comunidad que pueda ser adecuada para ellas.',
   'Koinonía comenzó como una iniciativa personal y hoy también forma parte de un proyecto académico que me ha permitido darle estructura y formalizar su desarrollo.',
   'Como parte del piloto, estamos preparando la plataforma para presentarla prontamente a un grupo de personas que buscan una iglesia o comunidad cristiana. Y esta podría ser una oportunidad para que su iglesia pueda ser elegida por una de estas personas.',
   `Se ha reservado una ficha administrable para ${name}. Su contenido aún no ha sido aprobado ni se ha autorizado su publicación. La invitación es para que una persona autorizada pueda revisar los datos y, si les interesa, proponer quiénes podrían colaborar en mantenerlos actualizados.`,
   `Conseguí esta dirección de correo mediante un servicio automatizado de recopilación de información pública de Google Maps. Las iglesias consideradas para este piloto están ubicadas en Santiago de Chile. Si el dato no corresponde o prefieren que no volvamos a escribir a esta dirección por este motivo, pueden indicarlo desde el enlace de la invitación.`
  ],
  example:{text:'Puedes conocer un ejemplo de perfil de iglesia en Koinonía y visualizar cómo podría presentarse la iglesia de ustedes:',label:'Ver perfil de Iglesia de Ejemplo.',url:'https://koinoniapp.cl/#/iglesia/ecf847447c3510c9841b862b?origen=descubrir'},
  sectionTitle:'¿Cómo pueden colaborar?', sectionText:'Revisando la ubicación, los horarios de reunión, los datos de contacto, las actividades y las condiciones de accesibilidad. Así, quienes busquen una iglesia podrán conocerla mejor antes de visitarla.',
  steps:['Reconoce la iglesia que aparece en la invitación.','Propón a las personas que colaborarán y sus funciones.','Envía la propuesta para que la administración de Koinonía la revise.'],
  note:'La participación es voluntaria. La información y cualquier propuesta quedan sujetas a revisión. También les invitamos a explorar la página y conocer los alcances y oportunidades que esta plataforma podría ofrecer a su iglesia.',
  cta:'Revisar la invitación', secondaryCta:'Explorar Koinonía',secondaryLink:'https://koinoniapp.cl/',help:invitationHelp
 };
}
function renewal({name}) {
 return {
  subject:`Tu nuevo enlace para la invitación de ${name} · Koinonía`, preheader:'Solicitaste un nuevo enlace para revisar la invitación de esta iglesia.',
  eyebrow:'NUEVO ENLACE DE INVITACIÓN', title:'Aquí tienes un nuevo enlace.',
  paragraphs:[`Se generó un nuevo enlace personal para revisar la invitación de ${name}.`,'Usa el botón para continuar con la invitación. Este enlace está dirigido al correo que recibió este mensaje.'],
  cta:'Abrir la invitación',
  help:'Si no solicitaste este enlace, puedes ignorar este correo. Recibirlo no concede permisos ni envía una respuesta a la invitación.'
 };
}
function clarification({name,clarification}) {
 return {
  subject:`Aclaración sobre la propuesta de ${name} · Koinonía`, preheader:'Revisa la solicitud y, si lo deseas, actualiza la propuesta.',
  eyebrow:'ACLARACIÓN SOLICITADA', title:'Hay un punto que necesitamos aclarar.',
  paragraphs:[`Gracias por enviar una propuesta para ${name}. Para poder continuar con su revisión, necesitamos la siguiente aclaración:`],
  sectionTitle:'Solicitud de aclaración', sectionText:clarification||'Abre la invitación para consultar la aclaración.',
  note:'Abre tu enlace personal para revisar la solicitud y, si lo deseas, volver a enviar la propuesta completa. La propuesta y las funciones sugeridas siguen pendientes de revisión.',
  cta:'Revisar y responder', help:institutionalHelp
 };
}
function member({name,role}) {
 const assigned=roles[role];
 if(!assigned)throw Error('Función de representante desconocida');
 return {
  subject:`Invitación para colaborar con ${name} · Koinonía`, preheader:`Revisa la función aprobada para ti y decide si deseas aceptarla.`,
  eyebrow:'INVITACIÓN PERSONAL AL EQUIPO', title:`Invitación para sumarte al equipo de ${name}`,
  paragraphs:[`La administración de Koinonía aprobó la función propuesta para ti en el equipo de ${name}. Revisa sus alcances y decide si deseas aceptar la invitación.`],
  sectionTitle:assigned.name, sectionText:assigned.scope,
  steps:['Abre la invitación personal.','Inicia sesión o crea una cuenta con la misma dirección de correo que recibió este mensaje.','Revisa la función y acepta si estás de acuerdo.'],
  note:role==='administrator'?'Si se está formando el primer equipo de la iglesia, la persona con función de Representante administrador debe aceptar primero.':'La persona con función de Representante administrador debe aceptar primero si aún no hay una administración activa para esta iglesia.',
  cta:'Revisar y aceptar mi participación', help:memberHelp
 };
}
function activated({name,role}) {
 const assigned=roles[role];
 if(!assigned)throw Error('Función de representante desconocida');
 return {
  subject:`Tu participación en ${name} está confirmada · Koinonía`, preheader:`Tu función de ${assigned.name.toLowerCase()} ya está activa.`,
  eyebrow:'PARTICIPACIÓN CONFIRMADA', title:'Gracias por sumarte al equipo.',
  paragraphs:[`Aceptaste tu participación en ${name}. Tu cuenta ya está vinculada a esta iglesia con la función indicada a continuación.`],
  sectionTitle:assigned.name, sectionText:assigned.scope,
  note:'Por seguridad, las sesiones anteriores dejaron de ser válidas. Usa el botón para iniciar sesión nuevamente y abrir la iglesia. En el panel de administración encontrarás el manual correspondiente a tu función, con información sobre sus alcances. Completa la verificación de correo o el segundo factor si se solicitan.',
  cta:'Ir a Koinonía', help:'Cuida tus credenciales y no compartas el enlace personal de invitación. Si la función indicada no coincide con lo acordado, contacta a la administración de tu iglesia.'
 };
}
// Preparadas para futuras notificaciones al contacto inicial. No activan nuevos envíos.
const updates = {
 received: ({name})=>({subject:`Recibimos la propuesta para ${name} · Koinonía`,preheader:'La propuesta quedó registrada para revisión.',eyebrow:'PROPUESTA RECIBIDA',title:'Gracias por enviar la propuesta.',paragraphs:[`La propuesta para colaborar con ${name} quedó registrada. Koinonía revisará la información y las funciones sugeridas. Si se necesita alguna aclaración, se solicitará mediante la invitación institucional.`],note:'El envío de la propuesta no concede acceso ni activa funciones. Las personas aprobadas recibirán invitaciones individuales para que decidan si aceptan.'}),
 approved: ({name})=>({subject:`La propuesta para ${name} fue revisada · Koinonía`,preheader:'Consulta el resultado de la revisión de las personas propuestas.',eyebrow:'REVISIÓN COMPLETADA',title:'La revisión de la propuesta está lista.',paragraphs:[`Koinonía terminó de revisar la propuesta para ${name}. Las personas aprobadas podrán recibir una invitación individual para revisar la función y decidir si la aceptan.`],note:'La aprobación de una propuesta no activa por sí sola el acceso. Cada persona debe aceptar su invitación individual; en equipos nuevos, la persona administradora debe aceptar primero.'}),
 rejected: ({name})=>({subject:`Actualización sobre la propuesta para ${name} · Koinonía`,preheader:'La propuesta fue revisada.',eyebrow:'ACTUALIZACIÓN DE LA PROPUESTA',title:'Gracias por presentar la propuesta.',paragraphs:[`Koinonía revisó la propuesta para ${name}, pero no aprobó las funciones sugeridas en esta revisión. Esta decisión se refiere a la propuesta recibida; no cambia la ficha de la iglesia ni concede o revoca accesos existentes.`]})
};
function content(stage,data) {
 if(stage==='institutional-reminder')return {...initial(data),subject:`Recordatorio: invitación para revisar la ficha de ${data.name} · Koinonía`,preheader:'Si les interesa participar, pueden revisar la invitación desde su enlace personal.',eyebrow:'RECORDATORIO DE INVITACIÓN',title:'¿Pudieron revisar la invitación?',paragraphs:[`Hace un tiempo enviamos una invitación para revisar la ficha administrable de ${data.name}. Si desean participar, pueden continuar desde el enlace personal incluido abajo.`],help:institutionalHelp};
 if(stage==='member-reminder')return {...member(data),subject:`Recordatorio: invitación para colaborar con ${data.name} · Koinonía`,preheader:'Revisa la función aprobada y decide si deseas aceptarla.',eyebrow:'RECORDATORIO PERSONAL',title:'Tu invitación sigue pendiente.'};
 const factory={initial,renewal,clarification,member,activated,...updates}[stage];
 if(!factory)throw Error('Plantilla de invitación desconocida');
 return factory(data);
}
module.exports={content};
