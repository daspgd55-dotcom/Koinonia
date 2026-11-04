const {createHash}=require('node:crypto');
const version='1.0 · 2026-11-04';
const documents={
 terms:{version,text:`Participación en Koinonía

Koinonía es un proyecto académico que invita a iglesias a revisar y completar su ficha. Esta invitación corresponde a la iglesia que aparece en pantalla. El enlace es personal. Si la ficha o el destinatario son incorrectos, puedes informarlo en la sección de problemas. También puedes declinar la invitación sin aceptar estas condiciones.

Al enviar la propuesta declaras que tienes autorización para coordinar esta respuesta. Puedes hacerlo sin formar parte del equipo. Antes de incluir a otra persona, explícale para qué se usarán su nombre, correo y función propuesta y obtén su permiso para compartirlos con Koinonía y para que reciba la invitación individual. Comprueba su dirección de correo antes de enviar.

El administrador de Koinonía revisará la propuesta y podrá solicitar aclaraciones, aprobar personas y funciones o rechazar la solicitud. La propuesta por sí sola no concede acceso. Cada persona aprobada decide si acepta desde una cuenta con su propio correo destinatario. Su acceso queda limitado a la iglesia y la función asignadas.

Quien acepte una función debe usar los permisos para las tareas de esa iglesia, cuidar los datos a los que tenga acceso y mantener sus credenciales personales. La presentación de la propuesta no publica ni verifica automáticamente la ficha.`},
 privacy:{version,text:`Datos y finalidad de esta invitación

El equipo de Koinonía gestiona este trámite. La invitación vincula una ficha existente con un correo de contacto y registra cómo se obtuvo. Al responder, se guardan tu nombre, tu vínculo con la iglesia, la respuesta y, cuando propones un equipo, los nombres, correos y funciones indicados. Esa vinculación puede revelar una relación con una comunidad religiosa. Incluye únicamente los datos solicitados y evita incorporar antecedentes personales adicionales.

Koinonía usa estos datos para revisar la propuesta, contactar a las personas aprobadas, gestionar su aceptación y asignar o retirar acceso a la iglesia. El administrador global puede consultar el expediente. Los servicios de alojamiento, base de datos y correo intervienen para operar el trámite. El proveedor de correo procesa el destinatario y el contenido de los mensajes. La propuesta no se publica en el catálogo de iglesias.

El expediente conserva las fechas, las decisiones, las versiones de los documentos aceptados y los eventos necesarios para seguir la invitación y resolver incidencias. Cuando una persona acepta, su cuenta se vincula con la iglesia y la función aprobada. Las comunicaciones se limitan a esta gestión y no implican una suscripción a publicidad.

Puedes solicitar acceso, corrección o eliminación de tus datos al equipo de Koinonía mediante el canal institucional que te hizo llegar esta invitación, indicando la iglesia y el correo afectado. En el trámite también puedes elegir «No contactar más este correo por esta iglesia». Koinonía conserva el registro necesario para respetar esa solicitud. Esta opción detiene el contacto para esa iglesia y correo, pero no elimina automáticamente el historial.`}
};
const revision=createHash('sha256').update(JSON.stringify(documents)).digest('hex');
function current(){return {enabled:true,...documents,revision};}
module.exports={current};
