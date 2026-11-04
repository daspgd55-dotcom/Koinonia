const {createHash}=require('node:crypto');
const version='2.0', footer='Versión '+version+' · 4 de noviembre de 2026';
const documents={
 terms:{version,text:`Condiciones de participación

Koinonía es una iniciativa personal para facilitar el encuentro entre personas, iglesias y comunidades cristianas. Su desarrollo también forma parte de un proyecto de titulación. Con esta invitación te proponemos colaborar en la actualización de la ficha de la iglesia que aparece en pantalla.

Quién puede responder

Puedes coordinar la respuesta aunque no quieras formar parte del equipo. Al enviar la propuesta, declaras que tienes autorización de la iglesia para presentarla. Si el mensaje llegó al contacto equivocado o la ficha corresponde a otra iglesia, puedes comunicarlo en la sección de problemas. También puedes rechazar la invitación sin aceptar estas condiciones.

Cómo proponer al equipo

Antes de incluir a alguien, explícale qué función propones, qué datos compartirás con Koinonía y que podría recibir una invitación personal. Obtén su permiso y comprueba su correo. Utiliza únicamente el nombre, el correo y la función necesarios para la propuesta.

Revisión y acceso

La administración de Koinonía revisa cada propuesta y puede pedir aclaraciones, ajustar funciones, aprobarla o rechazarla. Cada persona aprobada decide si acepta con una cuenta asociada al correo invitado. En iglesias sin administrador activo, la persona designada como administradora debe aceptar primero.

Al aceptar, te comprometes a usar tus permisos para las tareas de tu iglesia, cuidar la información a la que accedas y mantener en privado tus credenciales y enlaces personales. La aprobación de una propuesta no publica ni verifica automáticamente la ficha.

${footer}`},
 privacy:{version,text:`Política de privacidad de la invitación

Información que se registra

Koinonía vincula la ficha de la iglesia con el correo al que se dirige la invitación y registra la procedencia del contacto. Si respondes, se registra tu respuesta. Si presentas una propuesta, se guardan tu nombre, tu vínculo con la iglesia y los nombres, correos y funciones de las personas propuestas. Estos datos pueden revelar una vinculación con una comunidad cristiana. Evita incluir antecedentes personales ajenos a la invitación.

Finalidad y acceso

La administración de Koinonía utiliza esta información para revisar la propuesta, contactar a las personas aprobadas y gestionar sus permisos. Cuando una persona acepta, se vincula su cuenta con la iglesia y la función asignada. El administrador global puede consultar el expediente. La propuesta y los correos de sus integrantes no se publican en el catálogo de iglesias.

Los servicios de alojamiento y almacenamiento procesan la información necesaria para operar la aplicación. El proveedor de correo recibe la dirección de cada destinatario y el contenido del mensaje que debe enviar. Las comunicaciones se limitan a la invitación, su revisión y la activación del acceso. Aceptarlas no implica suscribirse a publicidad.

Registro y consultas

Koinonía conserva las fechas, decisiones, eventos de envío y versiones de los documentos aceptados para dar seguimiento a la invitación y resolver incidencias. Puedes solicitar acceso, corrección o eliminación de tus datos mediante el canal de contacto del equipo de Koinonía que te hizo llegar la invitación. Indica la iglesia y el correo asociado para que el equipo pueda localizar tu solicitud.

Si eliges «No contactar más este correo por esta iglesia», Koinonía conserva el registro necesario para respetar tu decisión. Si además deseas solicitar la eliminación de tus datos, puedes indicarlo al equipo por el mismo canal.

${footer}`}
};
const revision=createHash('sha256').update(JSON.stringify(documents)).digest('hex');
function current(){return {enabled:true,...documents,revision};}
module.exports={current};
