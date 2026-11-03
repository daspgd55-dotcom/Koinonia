# Correo institucional: plantillas, lotes y operación — etapa 6

Implementado en código, sin ejecutar pruebas, build, worker, backend ni envíos. No se modificaron credenciales, .env, políticas globales del piloto, Render ni datos de producción.

## Estado por defecto

- `OUTREACH_MAIL_ENABLED=false` por defecto. Interruptor propio del flujo, adicional a la política existente de cola; no activa campañas ni programas.
- `OUTREACH_MANUAL_URL` opcional: URL HTTPS sin credenciales. Ausente/vacía: se omite todo el párrafo del manual. No se creó manual.
- Para un envío futuro se requieren además la cola existente habilitada, transporte configurado, claves AES existentes y worker. No se cambia MAIL_QUEUE_ENABLED ni se agrega un fallback directo: los correos institucionales requieren cola para conservar reintentos e idempotencia.
- Configurar variables no envía por sí solo. Un administrador debe seleccionar destinatarios, preparar/revisar un lote y confirmar explícitamente su encolado.
- Con OUTREACH_MAIL_ENABLED=false el worker no toma trabajos de este flujo. Los otros correos siguen su comportamiento previo. Si luego se habilita, los trabajos pendientes vuelven a pasar por sus guardas; detener el flujo no retira mensajes en vuelo.

No se verificó qué variables están configuradas realmente en ningún servicio. Los textos legales definitivos siguen pendientes y bloquean la entrega de invitaciones institucionales que llevan a ese formulario.

## Plantillas

`church-outreach-mail-templates.js`, versión institutional-mail-1, texto plano (sin HTML ni píxeles). La institucional explica Koinonía, la ficha existente, procedencia general del contacto, información solicitada, tres pasos, revisión, independencia del contacto inicial respecto del equipo y opciones de iglesia incorrecta/rechazo/no contacto. No incluye evidencia interna ni notas administrativas. Las aclaraciones registradas para el destinatario pueden incorporarse.

La individual identifica iglesia y función efectiva aprobada, exige aceptación con cuenta destinataria y mantiene verificación/MFA. Explica primer administrador, conservación de asignaciones, relogin y ausencia de publicación/restauración/verificación automática. Puede rechazarse desde su pantalla autenticada.

Los recordatorios reutilizan el contenido, identificándose en el asunto. El manual se añade solamente cuando hay URL configurada. Las vistas previas muestran un marcador literal de enlace personal, no un enlace real ni un token. Remitente y origen del frontend se incluyen en la vista previa y su huella para detectar cambios.

## Bandeja operativa

En **Invitaciones a iglesias → Correos y lotes**. Los contactos se seleccionan expresamente desde la bandeja; los representantes, desde el detalle del ciclo. No existe selección automática ni campaña preconfigurada. Máximo 25 destinatarios por lote; cada destino se selecciona una vez. La marca de recordatorio es manual y no evade límites.

Se puede previsualizar, guardar una preparación de 24 horas, simular con el contexto actual, consultar trazabilidad o cancelar. Las exclusiones se explican por destinatario. Un lote con exclusiones no se envía parcialmente: se prepara otro con la selección válida. La simulación solo lee; no emite tokens, no modifica invitaciones, no genera MailJob ni llama a proveedores.

`ChurchOutreachMailBatch` conserva selección, preview, huella, creador, confirmador/cancelador, fechas, versión y clave idempotente de preparación. Guardar la misma clave con otro contenido se rechaza. Confirmar un lote ya encolado devuelve ese lote sin repetirlo. Si cambian versiones, elegibilidad, función, manual, remitente o contenido respecto de la vista previa, debe prepararse un nuevo lote.

## Exclusiones y recordatorios

Se excluyen ciclos cerrados/revocados/vencidos, destinatarios con no contacto, fichas ausentes/fusionadas, cambios pendientes de revisión, datos marcados como prueba, propuestas ya respondidas, representantes sin aprobación/invitación pendiente, entrega detenida, y falta de textos legales en el flujo institucional.

No contacto y bloqueo de entrega se buscan también en las fichas antiguas fusionadas hacia la ficha elegida (hasta 50 niveles y 1000 IDs; exceder el límite bloquea la operación). Esto no extiende la supresión a iglesias independientes ni a otros servicios de Koinonía. Se comprueba también la supresión del contacto institucional inicial para detener su ciclo.

Un correo inicial por ciclo/tipo/destinatario/revisión de origen; una aclaración nueva o una nueva aprobación individual permiten una nueva revisión de origen. Máximo dos recordatorios por esa revisión, incluso contando intentos preparados/cancelados, separados al menos 72 horas desde el último mensaje. Requieren evidencia de aceptación real del proveedor para el inicial; una simulación no habilita recordatorios.

Los recordatorios institucionales se detienen ante cualquier respuesta, incluida una aclaración pendiente. Los individuales se detienen ante aceptación/rechazo/revocación/vencimiento. También se detienen ante no contacto, cola anterior sin resolver, fallo, rebote o queja. No hay cron, timer de campaña, scheduler ni endpoint de «enviar a todos».

El receptor actual de webhooks solo conserva el tipo de evento, no una taxonomía detallada de rebotes; por prudencia **todo email.bounced se trata como bloqueo de entrega**, igual que complained. Se registra deliveryBlocked separado de noContact: no se inventa un consentimiento retirado por la persona. No se ofrece desbloqueo automático. Esta política evita reintentar un rebote permanente, aunque puede requerir revisión manual de un rebote recuperable.

## Transporte, seguridad e idempotencia

Confirmar el encolado hace una transacción: revalida la huella, emite/renueva tokens de cada destinatario, registra sus hashes, guarda mensajes cifrados en outbox, registra trazabilidad/auditoría y marca el lote queued. Los enlaces anteriores quedan inválidos. Ningún token aparece en la respuesta del lote o en su vista previa.

El contenido real incluye el enlace secreto y se persiste **solo cifrado**, usando `mail-queue.service.entry` con AES-256-GCM y AAD por UUID. Los modelos de acceso conservan únicamente hashes. El reconciliador existente copia a MailJob con UUID estable y después retira el outbox. Un índice logicalKey evita otro mensaje lógico inicial o recordatorio de la misma secuencia. No registrar payloads, textos reales ni respuestas del transporte en logs.

El worker reutiliza el transporte Resend existente, Idempotency-Key estable, timeout, Retry-After, espera exponencial y máximo seis intentos. Cada trabajo vence como máximo a las 23 horas; el token dura hasta siete días y está limitado por el ciclo/invitación individual. Los reintentos no generan enlaces nuevos. Un correo terminal fallido/cancelado no se convierte automáticamente en otro inicial: requiere una nueva revisión/ciclo según corresponda.

Guardas antes de enviar y después de consultar la cuota: lote confirmado y no cancelado, permiso de contacto, ficha/revisión vigente, token actual sin consumir, estados del destinatario y vigencia. El panel de correo de seguridad usa la misma guarda al ofrecer reintentos manuales. Cancelar borra outbox pendiente y vuelve obsoletos trabajos no terminales; no revoca un acceso ya aceptado ni puede retirar correo en vuelo.

Cuotas adicionales: cinco confirmaciones de lote por administrador/hora y tres mensajes por correo/día. Se conserva mail-global de 100 intentos/hora para todos los transportes. Estas cuotas son conservadoras: un fallo o reintento transaccional puede consumir cuota sin producir correo. La simulación y preparación no consumen cuotas de transporte.

## Entrega y observabilidad

`ChurchOutreachMail` enlaza lote, ciclo, destinatario, miembro cuando corresponde, plantilla, UUID de trabajo, estado, intentos, origen y fechas. El detalle institucional muestra hasta 100 registros recientes; cada lote muestra sus mensajes completos. El panel de correo general conserva Job/Event para diagnóstico.

- queued: salida preparada; aún no implica aceptación externa.
- accepted: aceptación de la API del proveedor o evidencia equivalente firmada; no confirma bandeja.
- delivered: webhook email.delivered.
- failed/bounced/complained/cancelled: estados distintos, con bloqueo según corresponda.

El webhook existente sigue verificando firma y actualizando eventos idempotentes. Proyecta el resultado al mensaje y, para el último mensaje institucional, a delivery. Eventos fuera de orden no rebajan un estado terminal de mayor prioridad. La reconciliación recupera proyecciones pendientes si el proceso cayó después del resultado del transporte. El registro de mensaje permite correlacionar webhooks incluso después de purgar MailJob por su retención habitual, si el proveedor aporta su ID/tag conocido.

Las aperturas y clics no se procesan como estados de negocio. **Ningún resultado de correo cambia response, acceptanceState ni activa permisos**. Solo las acciones explícitas del formulario o de la cuenta destinataria lo hacen. No se promete entrega exactamente una vez ni atomicidad entre MongoDB y un proveedor externo.

## API administrativa

Todas las rutas requieren auth + admin global y no-store. Prefijo `/api/church-outreach-mail-batches`:

| Ruta | Contrato |
| --- | --- |
| POST `/preview` | `{selections}`; lectura y exclusiones, sin guardar. |
| POST `/` | `{selections}`, Idempotency-Key UUID; guarda preparación. |
| GET `/` | page, 20 lotes; capacidades sin secretos. |
| GET `/:id` | lote, preview y metadatos de mensajes. |
| POST `/:id/simulate` | `{}`; evaluación actual sin token/outbox. |
| POST `/:id/enqueue` | If-Match, `{confirm:true}`; habilitación explícita y transacción. |
| POST `/:id/cancel` | If-Match, `{}`; detiene salida pendiente. |

Selección institucional: `{invitation,kind:"institutional",reminder:false}`. Individual: `{invitation,kind:"member",email,reminder:false}`; el servidor comprueba el correo aprobado. No acepta asuntos, textos, URLs de destino ni iglesias alternativas enviados por el cliente.

Quedan pendientes validaciones de ejecución y concurrencia, pruebas de proveedor/webhook en entorno aislado, textos legales definitivos y decisiones de activación/retención. Esta implementación no constituye una campaña activada.
