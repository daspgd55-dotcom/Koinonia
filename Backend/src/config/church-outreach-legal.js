const {createHash}=require('node:crypto');
const version='3.0', footer='Versión '+version+' · 11 de noviembre de 2026';
const documents={
 terms:{version,text:`Condiciones de participación

Koinonía es un proyecto en desarrollo temprano que busca facilitar el encuentro entre personas, iglesias y comunidades cristianas. Nació de una iniciativa personal y encontró en un proyecto académico de titulación una oportunidad para formalizar y avanzar en su desarrollo. Hoy invita a las iglesias a colaborar en su lanzamiento piloto, aportando información que ayude a las personas a conocerlas y acercarse a ellas.

Participación en el piloto

Esta invitación propone actualizar la información de la iglesia indicada y organizar un equipo autorizado para administrarla. Participar es voluntario. La aplicación continúa en desarrollo: sus funciones pueden ajustarse y pueden presentarse errores o interrupciones. La presencia de una ficha no implica certificación de sus enseñanzas, respaldo institucional de Koinonía ni garantía de las actividades que ofrece la iglesia. Abrir el enlace no acepta estas condiciones ni concede acceso; la propuesta se envía mediante una confirmación expresa.

Quién puede responder

Puedes coordinar la respuesta aunque no quieras formar parte del equipo. Al enviar la propuesta, declaras que tienes autorización de la iglesia para presentarla. Si el mensaje llegó al contacto equivocado o la ficha corresponde a otra iglesia, puedes comunicarlo en la sección de problemas. También puedes rechazar la invitación sin aceptar estas condiciones.

Cómo proponer al equipo

Antes de incluir a alguien, explícale qué función propones, qué datos compartirás con Koinonía y que podría recibir una invitación personal. Obtén su permiso y comprueba su correo. Utiliza únicamente el nombre, el correo y la función necesarios para la propuesta.

Revisión y acceso

La administración de Koinonía revisa cada propuesta y puede pedir aclaraciones, ajustar funciones, aprobarla o rechazarla. Cada persona aprobada decide si acepta con una cuenta asociada al correo invitado. En iglesias sin administrador activo, la persona designada como administradora debe aceptar primero.

Al aceptar, te comprometes a usar tus permisos para las tareas de tu iglesia, cuidar la información a la que accedas y mantener en privado tus credenciales y enlaces personales. La aprobación de una propuesta no publica ni verifica automáticamente la ficha.

Información y convivencia entre iglesias

El equipo de cada iglesia debe procurar que los datos, horarios y actividades publicados sean claros, actuales y fieles a su congregación. Comparte únicamente contenido que estés autorizado a utilizar y evita publicar datos personales de terceros sin su permiso.

Koinonía reconoce las diferencias doctrinales y de práctica entre comunidades cristianas. Participar no exige renunciar a las propias convicciones ni adherir a las de otras iglesias. Sí exige tratar con dignidad a las personas y respetar que otras congregaciones puedan ser de bendición para quienes se acercan a ellas. Expresa la identidad de tu iglesia con respeto, sin ataques, hostigamiento, suplantaciones ni descalificaciones dirigidas a otras comunidades.

Incidencias y continuidad

Si detectas información incorrecta, uso indebido de permisos o contenido que vulnera estas condiciones, comunícalo al equipo de Koinonía por el canal que te hizo llegar la invitación. El equipo podrá revisar la situación, solicitar correcciones y limitar o retirar accesos cuando corresponda. Puedes comunicar que no deseas continuar participando o solicitar la revisión de tu asignación.

${footer}`},
 privacy:{version,text:`Política de privacidad de la invitación

Alcance de esta política

Esta política explica el uso de los datos relacionados con la invitación y la propuesta de representantes durante el piloto. La coordinación de este proceso corresponde al equipo de Koinonía que te hizo llegar la invitación.

Información que se registra

Koinonía vincula la ficha de la iglesia con el correo al que se dirige la invitación y registra la procedencia del contacto. Si respondes, se registra tu respuesta. Si presentas una propuesta, se guardan tu nombre, tu vínculo con la iglesia y los nombres, correos y funciones de las personas propuestas. Estos datos pueden revelar una vinculación con una comunidad cristiana. Evita incluir antecedentes personales ajenos a la invitación, como documentos de identidad, información de salud, situaciones familiares o peticiones privadas de oración. Informa a las personas propuestas y obtén su autorización antes de compartir sus datos.

Finalidad y acceso

La administración de Koinonía utiliza esta información para revisar la propuesta, contactar a las personas aprobadas y gestionar sus permisos. Cuando una persona acepta, se vincula su cuenta con la iglesia y la función asignada. El administrador global puede consultar el expediente. La propuesta y los correos de sus integrantes no se publican en el catálogo de iglesias. La información que el equipo autorizado incorpore a los campos públicos de la ficha se utiliza para presentar la iglesia a quienes visitan la plataforma. Revisa qué campos son públicos antes de guardar.

Los servicios de alojamiento y almacenamiento procesan la información necesaria para operar la aplicación. El proveedor de correo recibe la dirección de cada destinatario y el contenido del mensaje que debe enviar. Las comunicaciones se limitan a la invitación, su revisión y la activación del acceso. Aceptarlas no implica suscribirse a publicidad.

Seguridad y cuidado de la información

Los enlaces de invitación son personales y tienen vigencia limitada. No los reenvíes ni compartas credenciales. Koinonía utiliza controles de acceso y registros para proteger la información y revisar incidencias; estos controles no eliminan todos los riesgos. Si sospechas que alguien accedió a un enlace o cuenta sin autorización, avisa al equipo de Koinonía.

Conservación y consultas

Koinonía conserva las fechas, decisiones, eventos de envío y versiones de los documentos aceptados para dar seguimiento a la invitación y resolver incidencias. Durante el piloto no se ha establecido un plazo único de eliminación automática para estos registros. Las solicitudes de eliminación se revisan individualmente; puede ser necesario conservar información mínima para atender incidencias, registrar decisiones o respetar una solicitud de no contacto. El equipo deberá explicar cualquier limitación al responder.

Puedes solicitar acceso, corrección o eliminación de tus datos mediante el canal de contacto del equipo de Koinonía que te hizo llegar la invitación. Indica la iglesia y el correo asociado para que el equipo pueda localizar tu solicitud. Antes de entregar o modificar información, el equipo podrá pedirte confirmar el control de ese correo. No envíes contraseñas ni enlaces de acceso. Puedes utilizar ese mismo canal para consultar el uso de tus datos o solicitar el cese de comunicaciones.

Si eliges «No contactar más este correo por esta iglesia», Koinonía conserva el registro necesario para respetar tu decisión. Si además deseas solicitar la eliminación de tus datos, puedes indicarlo al equipo por el mismo canal.

${footer}`}
};
const revision=createHash('sha256').update(JSON.stringify(documents)).digest('hex');
function current(){return {enabled:true,...documents,revision};}
module.exports={current};
