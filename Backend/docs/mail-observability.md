# Observabilidad del correo y panel de seguridad

## Estado

Panel en `/#/administracion/seguridad`, enlazado en Administración → Seguridad, exclusivo de admin. No cambia las políticas: envío directo predeterminado, cola preparada pero desactivada, verificación de correo pausada, CAPTCHA obligatorio desactivado. No envía recordatorios ni genera campañas. Consultar el panel nunca envía correos.

## Configuración manual del webhook

1. En Resend, crear un webhook con URL HTTPS del BACKEND: `https://<backend>.onrender.com/api/webhooks/resend`. No usar la URL del frontend ni una ruta con #.
2. Suscribirse únicamente a email.sent, email.delivered, email.delivery_delayed, email.bounced, email.complained y email.failed. No habilitar email.opened/clicked ni seguimiento de aperturas/píxeles. La aplicación ignora esos eventos aunque se reciban; no se agregó seguimiento.
3. Copiar el secreto de firma `whsec_...` a `RESEND_WEBHOOK_SECRET` en el servidor. Es distinto de RESEND_API_KEY y de las claves de cifrado. Nunca guardarlo en Git, Vite ni el navegador. Reiniciar API con el secreto. Sin él el endpoint responde 503 WEBHOOK_DISABLED; no afecta al transporte configurado.
4. Mantener `MAIL_WEBHOOK_SOURCE=provider` (predeterminado). Solo en una base aislada de pruebas puede usarse simulated; NODE_ENV=production lo rechaza. El cliente no puede elegir el origen. Para probar sin envíos reales, usar los tests incluidos: firman eventos localmente. No ejecutar simulaciones contra datos reales.
5. Confirmar conectividad, firmas y recepción mediante un entorno de staging antes de activarlo con tráfico real. No se creó el webhook ni se enviaron correos en este trabajo. La configuración del proveedor sigue siendo manual.

Resend/Svix firma los bytes originales con las cabeceras svix-id, svix-timestamp y svix-signature. Express recibe un Buffer (máximo 128 KiB, sin descompresión) ANTES de express.json. Svix valida firma y tolerancia temporal; recién después se interpreta JSON. Firma incorrecta o timestamp de firma vencido: 400. Tipo no admitido: 204 sin persistir contenido. Error de almacenamiento: 500 para permitir reentrega. Persistencia correcta o duplicado: 204. El endpoint no usa sesión porque su autenticación es la firma.

Referencia oficial: https://resend.com/changelog/managing-webhooks-via-api y https://resend.com/changelog/webhook-event-visibility .

## Identificadores, desorden e idempotencia

Los envíos directos y en cola registran el identificador devuelto por Resend, sin destinatario/asunto/cuerpo. Incluyen la etiqueta técnica koinonia_message (UUID interno, sin datos personales). El webhook puede asociar un evento a ese UUID antes de que llegue la respuesta del envío, incluso tras un timeout. La etiqueta se valida y solo enlaza trabajos existentes; no crea trabajos.

MailEvent usa svix-id como clave única: duplicados concurrentes no duplican eventos. Guarda solo providerId, tipo, fecha del evento, origen y retención; descarta todo el resto del cuerpo recibido (incluidos destinatarios, asunto, enlaces y motivos textuales del proveedor). Los eventos sin trabajo asociado se conservan durante la retención; una respuesta tardía puede completar la asociación. Un error entre persistir el evento y asociarlo provoca reentrega, que vuelve a intentar la asociación sin duplicar el evento.

No se aplica ciegamente “el último webhook recibido”. Los hechos permanecen independientes; la síntesis visible usa prioridad conservadora: queja > rebote > fallo > entrega > retraso > enviado. Por tanto un retraso antiguo no revierte una entrega, ni una entrega posterior oculta una queja. No pretende ser una cronología excluyente: pueden coexistir varias evidencias, visibles en detalles. Para cada tipo/origen se muestra su fecha más reciente.

El estado del trabajo y el del proveedor son dimensiones distintas. accepted significa aceptación de la petición por el proveedor; email.sent indica envío por el proveedor; email.delivered indica recepción por el servidor destinatario. Ninguno confirma lectura, verificación de cuenta, carpeta principal ni ausencia de filtrado posterior. Fallo local después de timeout puede coexistir con entrega confirmada posteriormente: se muestran ambos datos sin declarar que no se envió. Una confirmación del proveedor evita otro intento del worker y bloquea reintentos administrativos. Sigue existiendo una pequeña carrera con un envío ya en vuelo: no se promete entrega exactamente una vez.

## Panel, métricas y contrato

GET `/api/security/mail?page=1&state=failed`: admin, Cache-Control: no-store, 20 filas por página, filtro de estado validado. Devuelve lista explícita sin payload, token, destinatario, asunto, claves ni cuerpo. Los datos de auditoría contienen ID del administrador y fecha, sin correo. Configuración visible: modos y booleanos, nunca secretos.

Métricas del período retenido:
- Trabajos por estado y origen, volumen de intentos y reintentos de transporte.
- Tiempo medio desde solicitud hasta aceptación cuando existen ambas fechas; “sin dato” si no hay evidencia. No es tiempo hasta lectura ni entrega.
- Pendientes de cola y antigüedad del más antiguo, además de cantidad y fecha más antigua del outbox todavía no reconciliado. Outbox histórico sin fecha se muestra sin dato.
- Eventos por tipo y origen, deduplicados por providerId. Un mensaje puede sumar en varias categorías; no sumar esos conteos como mensajes únicos. Incluye eventos aún no asociados a trabajos, indicado en la interfaz.

application significa dato local de cola; provider identifica el transporte/evento del proveedor; simulated identifica adaptadores y eventos de prueba. No tener eventos se muestra como ausencia de datos, no como cero fallos o entrega confirmada. No existe reconstrucción histórica de envíos anteriores a esta instrumentación. La observabilidad del envío directo es de mejor esfuerzo: un fallo de registro no impide un correo necesario, pero puede dejar huecos en métricas (MAIL_OBSERVATION_UNAVAILABLE). Un envío directo cuyo proceso cae puede quedar “sin confirmar”; no se reenvía automáticamente.

POST `/api/security/mail/:id/retry`: admin, máximo 10 solicitudes/hora por administrador. Solo trabajos en retry de cola, con payload disponible, vigencia y hash actuales, menos de 6 intentos de transporte, espera Retry-After cumplida, máximo 3 reintentos manuales y cooldown 60 s. No se renueva token, no se reinician intentos ni se llama directamente al proveedor. CAS sobre versión temporal/estado/intentos evita doble actualización concurrente y registra actor, fecha y acción en el mismo update. El worker vuelve a verificar vigencia. Confirmaciones del proveedor, trabajos directos, definitivos, vencidos, reemplazados o sin contenido no son elegibles. 409 indica no elegible o cambio concurrente. La cola desactivada impide reintentar.

Un reintento manual adelanta únicamente trabajos cuya espera ya se cumplió; no anula Retry-After ni salta cuotas. Los trabajos terminales eliminaron su contenido cifrado y no se pueden recrear desde este panel. No hay botón de reenvío masivo ni mecanismo para activar cuentas pendientes.

## Retención y limitaciones

MailJob terminal: TTL predeterminado de 7 días desde su terminación; trabajos activos quedan excluidos. MailEvent: 7 días desde recepción. Ambas retenciones son configurables (security-maintenance.md); MongoDB procesa TTL eventualmente. Auditoría embebida del trabajo: misma retención, máximo 20 entradas; reintentos manuales limitados a 3. Payload de cola se elimina al quedar terminal, antes del TTL. Outbox cifrado permanece mientras el worker esté detenido: al reanudarse se reconcilia y descarta lo vencido; no se borra una cuenta mediante TTL ni se promete limpieza del outbox sin worker. Fechas e identificadores son información operativa: acceso limitado a admin y base de datos.

No es un SIEM, una alerta automática ni un informe histórico permanente. No implementa bounces por destinatario múltiple: cada envío actual tiene un solo destinatario. Otros eventos nuevos del proveedor se ignoran hasta incorporarlos explícitamente. No se activó seguimiento de lectura ni se expone un píxel.

## Pruebas aisladas

Backend: `node --test --test-concurrency=1 test/mail-observability.test.js test/mail-queue.test.js test/email-security.test.js test/security-policy.test.js`.
Frontend: `node test/security-mail.cjs`, `npm run build`.
Cubren firmas válidas/incorrectas/vencidas, cuerpo original, duplicados concurrentes, desorden, fallos de almacenamiento/reentrega, asociación tardía, confirmación tras timeout, permisos, privacidad, métricas simuladas, auditoría y reintentos inválidos. Navegador móvil: admin, representante denegado, filtro vacío y solicitud de reintento sin ejecutar worker. No usan producción ni llaman a Resend.
