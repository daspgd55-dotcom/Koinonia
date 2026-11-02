# Inscripción y convalidación de iglesias

Implementación local de la primera versión. No se ejecutaron pruebas, comprobaciones de sintaxis, build ni recorridos de navegador en esta entrega. No se enviaron correos reales ni se conectó a una base de datos durante el desarrollo. La presencia del código no acredita su funcionamiento desplegado.

## Recorrido

`#/inscribe-tu-iglesia` reúne cuatro pasos: iglesia, solicitante, equipo y revisión/consentimientos. La búsqueda pública usa el catálogo existente; no revela borradores ni fichas inactivas. Los correos propuestos son privados. No crea cuentas ni concede permisos al enviar.

La solicitud separada recibe una referencia aleatoria y un enlace de confirmación de 24 horas, consumido mediante POST explícito. La confirmación es independiente de EMAIL_VERIFICATION_REQUIRED. Una sesión privada de seguimiento de dos horas queda solo en memoria del navegador; se recupera mediante referencia y correo, con respuesta genérica. Corregir correo solo es posible antes de confirmarlo. La corrección invalida enlaces anteriores. Se admiten enlaces de confirmación de la primera entrega mientras sigan vigentes.

La persona puede responder aclaraciones, retirar el trámite, pedir no contacto o solicitar eliminación. Una retirada posterior a aprobar conserva la aprobación y las asociaciones; no borra iglesias ni cuentas. No contacto detiene nuevos envíos de este trámite y revoca invitaciones pendientes. El seguimiento existente permite consultar la atención hasta vencer; no se envían nuevos enlaces de recuperación cuando hay no contacto. Los mensajes ya entregados o en vuelo al proveedor no pueden recuperarse.

## Administración

`#/administracion/inscripciones`, exclusivo del administrador global, ofrece bandeja paginada, filtro de estado, historial, mensajes visibles al solicitante y peticiones de privacidad.

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
