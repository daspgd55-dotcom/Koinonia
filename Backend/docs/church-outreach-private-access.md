# Acceso privado institucional — etapa 2

Implementado en código, pendiente de verificación en ejecución. No se ejecutaron pruebas, build, backend ni operaciones externas. La etapa 3 añade el formulario de representantes, con envío bloqueado hasta configurar textos legales definitivos. Aprobación, manual y correo siguen pendientes.

## Contrato

Todas las rutas siguientes tienen prefijo `/api`. Cuerpos estrictos: campos adicionales (incluidos iglesia, destinatario, usuario y permisos) se rechazan.

| Método y ruta | Requisito / cuerpo | Resultado |
| --- | --- | --- |
| POST `/church-outreach-invitations/:id/link` | Admin autenticado, `If-Match: "version"`, `{}` | `path`, `expiresAt`, `version`, `delivery: not_sent`. Emite o renueva; el secreto solo se devuelve esta vez. |
| POST `/church-outreach-access/begin` | `{token}` | Consume enlace y devuelve `sessionToken`, `expiresAt`, `church: {name, location}`, `legal`. |
| POST `/church-outreach-access/response` | `X-Outreach-Session`, `{answer, submission}` para received; `{answer}` para retirada/corrección | Mensaje común de respuesta registrada, sin datos privados. |

`path` es una ruta del **frontend** (`/#/invitacion-iglesia?token=…`), no del backend. La futura entrega debe unirla al origen HTTPS del frontend configurado por servidor, nunca al Host suministrado por el solicitante. No hay endpoint público para buscar correos ni recuperación por correo, ni se promete un envío inexistente. La renovación se solicita al administrador y se efectúa mediante el primer endpoint. La interfaz administrativa está disponible en la etapa 4; falta el transporte de correo.

No existen GET de acceso privado: abrir la página solo presenta información genérica y un botón. No consume tokens, guarda respuestas ni llama a la API de invitaciones. Los escáneres de enlaces que hacen GET no inician el trámite. Un POST explícito registra `access_started`, que significa uso de una credencial; **no certifica humanidad, identidad, control exclusivo del buzón ni autoridad institucional**.

## Credenciales y concurrencia

`ChurchOutreachAccess` almacena SHA-256 de 32 bytes aleatorios criptográficos, invitación, propósito (`institutional_link` o `institutional_session`), fechas, consumo y revocación. Nunca se guarda el secreto en texto plano. No admite intercambiar un enlace por una respuesta ni una sesión por otro inicio. Sin TTL: la caducidad se comprueba en cada operación, independientemente de limpieza futura.

El enlace dura hasta 7 días y la sesión hasta 30 minutos; ambos limitados además por el vencimiento de la invitación. El navegador conserva la sesión solo en memoria y elimina el secreto del fragmento tras iniciar; recargar requiere renovación. El fragmento no se envía como URL HTTP ni como Referer. Respuestas API usan `no-store`; no registrar cuerpos, cabeceras de sesión ni respuestas de emisión en futuros logs/proxies. El enlace sigue siendo una credencial de portador: reenviarlo antes del primer uso permite usarlo a otra persona, por eso no otorga permisos.

Consumo, creación de sesión, cambios y auditoría usan transacciones. El bloqueo por contacto y la escritura de versión de invitación serializan inicios, renovación y retirada. Renovar revoca todos los enlaces y sesiones anteriores; no amplía la vigencia de la invitación. Las acciones administrativas invalidan los accesos de la invitación, incluso una nueva revisión del destino. Una revocación de otro ciclo por no contacto también queda efectiva porque cada acceso vuelve a comprobar ciclo y supresión.

Solo se emite/inicia sobre una invitación `ready`, sin respuesta o con aclaración pendiente, vigente, sin supresión y con destino revisado. Iglesia y destinatario se obtienen de esa invitación. Fusiones, ficha ausente o huella cambiada bloquean inicio e interés hasta revisión administrativa; nunca se reasignan desde el enlace. La sesión privada recibe el nombre y ubicación revisados (address, commune, city), incluso en borradores: no coordenadas, correos, notas, procedencia, estado interno ni equipo. Cambiar la iglesia requiere revocar y preparar otra invitación.

## Respuestas y auditoría

| answer | Cambio |
| --- | --- |
| received | Propuesta y aceptación versionada registradas (`response.state=received`); ciclo permanece ready para revisión administrativa, sin nuevas emisiones ni sesiones. No concede acceso. |
| wrong_church | Respuesta iglesia incorrecta; ciclo cerrado. Admin debe investigar y preparar un nuevo ciclo si corresponde. |
| wrong_contact | Contacto equivocado; ciclo cerrado. No modifica ni reemplaza el correo. |
| declined | Rechazo de esta invitación; ciclo cerrado. No supone baja permanente. |
| no_contact | Respuesta declined y marca explícita noContact; ciclo revocado, supresión persistente por iglesia+correo. |

Todas consumen la sesión al revocar las credenciales y requieren una acción explícita en la interfaz. La retirada/corrección sigue permitida si la huella cambió después de iniciar, siempre que la sesión/ciclo sigan vigentes. Una repetición devuelve el mismo error genérico de acceso no disponible; no duplica respuestas. No se guardan comentarios libres en esta etapa. No se escriben Church ni User.

Eventos `link_issued`, `access_started`, `response_recorded` y `no_contact_recorded` conservan versión, estado de respuesta y actorType. El actor admin se toma de autenticación; recipient significa portador de sesión, sin atribuirle un User ni fingir que es representante. No se guardan secretos en eventos.

## Cuotas y límites

Se reutiliza SecurityLimit con claves HMAC y ventanas fijas: 40 operaciones públicas/IP/15 minutos, 10 intentos/enlace/15 minutos, 20 intentos/sesión/15 minutos. Emisión: 30/admin/hora, 5/invitación/día y 5/contacto de iglesia/día; mínimo 60 segundos entre emisiones exitosas. Los intentos fallidos también consumen cuota. Se requiere configurar correctamente el proxy de confianza, igual que en autenticación. No se usan direcciones IP ni correos en claro como claves de cuota.

Accesos inexistentes, vencidos, consumidos, revocados, suprimidos o con destino no disponible devuelven el mismo 400 `INVITATION_UNAVAILABLE`; 429 es independiente de si existe un contacto. Errores de forma pueden devolver validación 400. No hay búsqueda de contactos por el público. Esto no promete indistinguibilidad temporal perfecta ni protección volumétrica externa.

La supresión aún no se propaga entre iglesias fusionadas ni entre otros servicios; el envío continúa sin implementar y `canSend=false`. Antes de campañas deben implementarse exclusiones por identidad fusionada, entrega/outbox, cuotas del proveedor y revisión del destino al enviar. No se activa automáticamente correo, cuentas, roles ni requisitos de verificación.

La etapa 4 permite solicitar aclaraciones y revisar personas sin activar accesos: [Bandeja administrativa](church-outreach-admin.md).
