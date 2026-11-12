# Inscripción y convalidación de iglesias

Implementación local de la primera versión. No se ejecutaron pruebas, comprobaciones de sintaxis, build ni recorridos de navegador en esta entrega. No se enviaron correos reales ni se conectó a una base de datos durante el desarrollo. La presencia del código no acredita su funcionamiento desplegado.

## Recorrido

`#/inscribe-tu-iglesia` reúne cuatro pasos: iglesia, solicitante, equipo y revisión/consentimientos. La búsqueda de inscripción usa GET /lookup y permite identificar fichas publicadas, borradores e inactivas, por petición expresa del usuario. Solo devuelve ID, nombre, dirección, comuna y ciudad; no devuelve estado interno, contactos, equipo, anotaciones ni la ficha completa. Omite registros fusionados. No amplía los permisos de consulta del catálogo público habitual. Los correos propuestos son privados. El solicitante puede figurar también como representante con el mismo correo; solo se rechazan filas repetidas dentro del equipo. La corrección del correo del solicitante antes de confirmar también admite coincidencia con un representante. No crea cuentas ni concede permisos al enviar.

La solicitud separada recibe una referencia aleatoria y un enlace de confirmación de 24 horas, consumido mediante POST explícito. La confirmación es independiente de EMAIL_VERIFICATION_REQUIRED. Una sesión privada de seguimiento de dos horas queda solo en memoria del navegador; se recupera mediante referencia y correo, con respuesta genérica. Corregir correo solo es posible antes de confirmarlo. La corrección invalida enlaces anteriores. Se admiten enlaces de confirmación de la primera entrega mientras sigan vigentes.

La persona puede responder aclaraciones, retirar el trámite, pedir no contacto o solicitar eliminación. Una retirada posterior a aprobar conserva la aprobación y las asociaciones; no borra iglesias ni cuentas. No contacto detiene nuevos envíos de este trámite y revoca invitaciones pendientes. El seguimiento existente permite consultar la atención hasta vencer; no se envían nuevos enlaces de recuperación cuando hay no contacto. Los mensajes ya entregados o en vuelo al proveedor no pueden recuperarse.

## Administración

`#/administracion/inscripciones`, exclusivo del administrador global, ofrece una bandeja con búsqueda por iglesia/correo/referencia, contadores globales por estado, paginación y filtros. El detalle se organiza en Revisión, Aprobación, Equipo y contacto, e Historial y privacidad; las pestañas admiten flechas, Inicio y Fin, y conservan los formularios al alternarlas. Al abrir una solicitud se consultan coincidencias automáticamente.

La convalidación busca nombres, direcciones, comunas y enlaces en registros públicos, borradores e inactivos. Sugiere coincidencias con señales y discrepancias explícitas, sin resolver identidad automáticamente. Muestra hasta 100 candidatos: si se alcanza el límite, refinar manualmente. Las sugerencias se recalculan; la decisión y su fundamento quedan persistidos.

Los registros fusionados se resuelven a su ficha principal, detectando ciclos. Los marcados como datos de prueba no pueden convalidarse para esta inscripción real. Una ficha existente no convierte por sí sola el trámite en duplicado; el estado Duplicada exige otra solicitud principal vigente.

Guardar una convalidación registra iglesia destino, versión, administrador, motivo y fecha. Si cambia la iglesia antes de aprobar, se exige revisar nuevamente. La aprobación diferencia identidad y autorización institucional. El motivo de inactividad debe revisarse expresamente; aprobar no restaura la ficha. El equipo vigente se muestra y se conserva.

## Aprobación y enriquecimiento

La aprobación se ejecuta en una transacción MongoDB e incluye iglesia, solicitud, procedencia y evento. Repetirla sobre una solicitud ya aprobada devuelve el resultado existente. Se requiere MongoDB replica set, como el usado por la gestión actual de equipos; no hay fallback a escrituras parciales.

- Destino existente: se conserva el ID y sus relaciones. Solo se incorporan los campos expresamente seleccionados en la comparación: nombre, dirección, comuna, ciudad y sitio web. Cambiar datos devuelve la ficha a borrador, conservando la autorización histórica de publicación según el comportamiento actual del proyecto.
- Destino nuevo: requiere decisión administrativa previa y coordenadas confirmadas. Se crea un borrador. Se rechaza una coincidencia exacta de nombre/dirección/comuna encontrada y se reserva una clave normalizada única para evitar dos aprobaciones simultáneas de la misma identidad nueva. No sustituye la revisión humana de sedes, traslados y nombres alternativos.
- Cambiar dirección, comuna o ciudad exige coordenadas confirmadas; no conserva silenciosamente coordenadas anteriores.
- Las redes sociales se conservan como evidencia de la solicitud. Se incorporan en el editor institucional para evitar inferir campos o sobrescribir enlaces sin revisión.
- La procedencia queda en la solicitud, en el evento de aprobación y en Church.registrationSources (privado y excluido de serialización pública).

No se marca automáticamente Church.verification.authorized ni se publica/verifica la ficha: siguen siendo operaciones institucionales separadas.

## Invitaciones y cuentas

El administrador elige funciones aprobadas entre los correos propuestos. La persona solicitante debe figurar como administradora de iglesia para poder enriquecer la ficha con los permisos existentes. No equivale a admin global. Los demás pueden ser administrator, editor, moderator o welcome; también pueden omitirse.

Tras aprobar, el panel permite enviar/renovar cada invitación o revocarla. No se manda correo a terceros solo por escribirlos en el formulario. Las invitaciones vencen en 24 horas y pueden renovarse con cuotas. Una persona puede rechazar sin crear una cuenta y solicitar no contacto para esta invitación.

Aceptar exige el enlace vigente, una sesión autenticada activa del mismo correo y aceptación expresa. Una cuenta inexistente se crea mediante el registro habitual; el retorno desde login/registro lleva a la invitación. Si el registro exige verificación o MFA, siguen aplicándose esos controles; se puede volver al enlace original después. No se reemplazan contraseñas ni se apropian cuentas por coincidencia de email.

La aceptación registra confirmación de correo dentro del trámite, consentimiento, usuario y fecha, y asigna el equipo en una transacción. No falsifica User.emailVerifiedAt. Se promueve user a representative y se incrementa sessionVersion, obligando a iniciar sesión nuevamente. Una asignación previa conserva su función; los cambios de permisos existentes se realizan desde la gestión de equipo. El límite sigue siendo 20 representantes; para un equipo nuevo debe aceptar primero una persona administradora. Las asignaciones nunca se propagan a otras iglesias.

## Correo y protección de datos

El correo reutiliza la configuración del backend. Con MAIL_QUEUE_ENABLED=false utiliza transporte directo; con true crea una entrada cifrada en outbox dentro de la transacción, que recoge el worker existente. No se modifican estas políticas ni las credenciales del piloto.

Los enlaces se almacenan como hash en ChurchRegistrationAccess y tienen TTL. La cola comprueba vigencia y permiso de contacto antes del envío. Cambiar/revocar un enlace lo vuelve obsoleto; la recuperación de fallos directos se hace reenviando un enlace nuevo. Un estado `sent` indica aceptación del envío directo, no entrega en bandeja. `queued` no certifica envío: el panel general de observabilidad conserva los resultados del worker/proveedor.

Las cuotas incluyen 90 solicitudes al conjunto de endpoints por IP cada 15 minutos; 5 inscripciones/IP/hora; 3 inscripciones/correo/hora; recuperación e invitaciones con cuotas adicionales. Las referencias no autorizan lectura privada: se necesita el secreto de sesión en X-Registration-Session. Los datos del seguimiento no se guardan en localStorage/sessionStorage. Los tokens de enlace permanecen en fragmento de URL y se retiran después de consumirlos.

El historial nuevo se guarda en ChurchRegistrationEvent; se conserva la lectura del historial embebido anterior. Las acciones registran actor, motivo, campos y fecha cuando corresponda. Los eventos de aceptación no copian tokens ni contraseñas.

La primera versión agenda una revisión administrativa de conservación a los 180 días. Es una fecha de revisión, no una autorización de borrado ni una certificación jurídica. No hay eliminación automática. El administrador resuelve peticiones y puede anonimizar expresamente la solicitud cuando se pidió eliminación: limpia datos personales, comentarios y contenido personal del historial, revoca accesos e invitaciones y cancela cargas pendientes de correo vinculadas. Se conservan referencias institucionales y auditoría mínima. Iglesias, cuentas, backups y correos ya entregados no se eliminan mediante esta acción.

## API

Todas las rutas bajo `/api/church-registrations`; respuestas privadas con Cache-Control: no-store.

| Método/ruta | Acceso | Acción |
|---|---|---|
| POST / | Público, cuotas | Crear solicitud y sesión inicial |
| POST /confirm | Token de un uso | Confirmar/abrir seguimiento |
| POST /recover | Referencia + correo, respuesta genérica | Renovar enlace |
| GET /lookup?q=... | Público, cuotas | Buscar registros para inscribir; incluye borradores e inactivos con proyección mínima |
| GET /track | X-Registration-Session | Seguimiento privado |
| POST /respond | Sesión privada + versión | Responder, corregir correo, retirar o pedir privacidad |
| POST /invitation | Token | Consultar función y destinatario de la invitación |
| POST /decline | Token | Rechazar y registrar no contacto |
| POST /accept | Token + cuenta autenticada del mismo correo | Aceptar y asignar |
| GET / | Admin | Bandeja paginada |
| GET /:id | Admin | Detalle y últimos 200 eventos |
| GET /candidates?requestId=...&q=... | Admin | Coincidencias; q opcional |
| GET /target/:id | Admin | Resolver principal y consultar campos/equipo |
| PATCH /:id | Admin + versión | Revisar, convalidar y resolver estados |
| POST /:id/approve | Admin + versión | Aprobar destino, datos y funciones |
| POST /:id/invite | Admin + versión | Enviar/renovar invitación individual |
| POST /:id/revoke | Admin + versión | Revocar invitación pendiente |
| POST /:id/notify | Admin + versión | Enviar enlace de seguimiento al solicitante |
| POST /:id/privacy | Admin + versión | Resolver petición y anonimizar si se solicita |

Las rutas no permiten que el navegador establezca un rol global, falsee confirmaciones, publique la iglesia o cambie políticas de seguridad.

## Estado de validación

Implementación incorporada al checkout; sin pruebas ejecutadas por instrucción del usuario. No se afirma que el recorrido, las transacciones, el worker o la interfaz estén verificados en ejecución. Antes de un despliegue deben comprobarse en un entorno aislado, incluyendo concurrencia, conservación de equipos, flujo de registro/login/MFA, no contacto, cola y errores de proveedor. No se configuraron proveedores ni se hicieron escrituras de producción.

## Refinamiento de interfaz — 2026-11-03

- Formulario en cuatro pasos con progreso, ayuda breve, tarjetas de datos y resumen editable; sitio web/redes opcionales plegables.
- Búsqueda independiente con estados de carga, error, sin coincidencias y resultados; consulta desde tres caracteres, insensible a mayúsculas y tildes del nombre. Máximo diez resultados y aviso para refinar cuando hay más. Cancela respuestas obsoletas al cambiar la consulta. Seleccionar una ficha completa campos vacíos sin sobrescribir texto editado por la persona.
- Casillas y radios con ancho fijo de 20 px, sin heredar width:100% de los inputs generales. Declaraciones en dos columnas: casilla y texto flexible; diseño adaptable y sin animaciones adicionales.
- Botón para incluir al solicitante en el equipo con su mismo correo. La asignación final sigue pasando por aprobación y aceptación, sin crear dos representantes para el mismo correo.
- Textos de consentimiento de nuevas solicitudes versionados como 2: «Estoy autorizado para presentar esta solicitud. Declaro que cuento con autorización de la iglesia para realizar su inscripción» y «Acepto las comunicaciones sobre la inscripción. Incluyen confirmación de correo, revisión y resolución de la solicitud. No incluyen publicidad». Los registros anteriores conservan su versión.
- Lookup: 60 consultas por IP en 15 minutos, además de la cuota general. Exige q de 3 a 120 caracteres, escapa expresiones regulares y no permite listar todos los registros con una consulta vacía. La selección de sugerencias acepta fichas que todavía no están publicadas.

No se ejecutaron pruebas, compilación ni verificación visual en navegador en este refinamiento, siguiendo la instrucción vigente del usuario. La revisión realizada fue por lectura del código; no certifica el resultado desplegado.


## Ajustes del 12 de noviembre de 2026

- POST /church-registrations exige textos descriptivos: mínimo 3 caracteres para nombres, comuna, ciudad y vínculos; 5 para dirección; al menos dos letras distintas y exclusión de relleno evidente. No es validación semántica ni prueba de existencia; la revisión humana sigue siendo necesaria.
- Nuevo objeto obligatorio `church.authorityContact`: `name`, `role`, `authorized: true` y al menos uno de `email` o `phone`. Email normalizado; teléfono de 8 a 15 dígitos con formato permitido y rechazo de repetición evidente. Se registra permiso de contacto en consentimientos v3 y procedencia declarada. No se envían mensajes automáticamente a esta autoridad ni se incorpora su contacto al perfil público. El objeto se elimina con la anonimización de la solicitud.
- Las solicitudes anteriores siguen disponibles sin migración; administración muestra que falta el antecedente y debe obtenerlo antes de aprobar. No se certifica automáticamente la autoridad por tener un correo o teléfono.
- Seguimiento: estado y siguiente paso visibles; corrección de correo, equipo, referencia y privacidad plegados. Sin formulario duplicado de recuperación mientras hay sesión de seguimiento.
- Solicitante sin confirmar: permanece pendiente, no se aprueba ni se confirma manualmente. Administración puede reenviar (cuotas existentes) o cerrar expresamente con motivo registrado. No hay eliminación automática. Contador «Esperando correo» filtra estos casos.
- Representantes: confirmación independiente al aceptar o rechazar invitación. Tras aprobación se pueden enviar/renovar o revocar las invitaciones pendientes; solo aceptar con la cuenta destinataria concede permisos. Confirmar el buzón no acredita autoridad institucional ni cambia automáticamente User.emailVerifiedAt.
- No se ejecutaron pruebas ni compilación en esta modificación; no se enviaron correos ni se realizaron cambios en bases de datos.
