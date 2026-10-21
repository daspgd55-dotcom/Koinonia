# Cola persistente de correo

## Estado y configuración

Preparada; el piloto conserva MAIL_QUEUE_ENABLED=false y EMAIL_VERIFICATION_REQUIRED=false. No se cambió el .env real ni se enviaron correos externos. El modo cola es independiente de la exigencia de verificación: puede probarse con representantes y contraseñas provisionales mientras la verificación sigue pausada.

Configuración manual del servidor API y del worker:
- RESEND_API_KEY, MAIL_FROM y APP_PUBLIC_URL: transporte actual.
- MAIL_QUEUE_ENABLED=true: las nuevas solicitudes guardan salida pendiente, no envían directamente.
- MAIL_QUEUE_ENCRYPTION_KEYS: objeto JSON de identificador a clave AES de 32 bytes en base64.
- MAIL_QUEUE_ACTIVE_KEY_ID: identificador presente en ese objeto.

Generar una clave propia con un generador criptográfico (por ejemplo node:crypto.randomBytes(32).toString('base64')), guardarla en el almacén de secretos y respaldarla fuera de la base. No reutilizar JWT_SECRET ni claves MFA. Para rotar, añadir una clave nueva y cambiar el identificador activo en API y workers; conservar claves antiguas hasta agotar sus trabajos y outbox. Perder una clave impide enviar su contenido: se deja en retry/encryption_unavailable hasta recuperar la clave o vencer, nunca se imprime el ciphertext. Configuración incompleta con cola activa impide iniciar. Con cola desactivada y configuración ausente se inicia normalmente.

Worker separado: desde Backend ejecutar `npm run worker:mail`. API y worker comparten MongoDB, configuración de correo y llavero. El servidor HTTP no inicia workers. El worker reconcilia hasta 100 usuarios por ciclo y procesa un trabajo; espera 2 s cuando no hay trabajo. SIGINT/SIGTERM termina tras el intento actual. Puede ejecutarse más de una instancia.

## Outbox y recuperación

La emisión de token y el registro cifrado de correo se escriben atómicamente en el mismo documento User (emailAction/passwordReset + mailOutbox). No requieren transacciones ni un replica set. Si el proceso cae después del guardado, el outbox sigue disponible. El worker copia cada elemento a MailJob mediante upsert con UUID estable y después retira ese elemento del usuario. Caer entre copiar y retirar produce otro upsert del mismo trabajo, no otro correo lógico. No es necesario que el worker esté activo cuando se solicita un enlace.

El cambio/restablecimiento de contraseña guarda su aviso en el mismo update del usuario. Un fallo de entrega posterior nunca revierte contraseña ni sesiones. Si excepcionalmente falla la preparación del cifrado del aviso, se registra PASSWORD_NOTICE_PREPARE_FAILED sin datos personales y se permite el cambio; se documenta esta pérdida excepcional del aviso, no se simula que quedó en cola. En modo directo se conserva el tratamiento anterior de fallos.

Los registros sensibles (destinatario, remitente, texto/enlace, asunto y condición de validez) se cifran con AES-256-GCM y AAD vinculado al UUID del trabajo. Los campos de outbox y payload se excluyen de consultas ordinarias; no hay API administrativa ni métricas que los expongan. No registrar cuerpos ni respuestas crudas del proveedor. Los logs contienen solo códigos de fallo. Los trabajos terminales eliminan payload; metadatos terminales se purgan por TTL a los 7 días de terminar, configurables; los trabajos activos no tienen TTL destructivo (ver security-maintenance.md). El outbox se elimina después de copiar, no antes.

## Estados, bloqueos e intentos

Estados: pending, processing, retry, accepted, failed, obsolete. accepted significa aceptación de la API del proveedor, no entrega a bandeja ni lectura. Campos: attempts, nextAttemptAt, expiresAt, leaseUntil, owner, failure. Toma atómica con findOneAndUpdate, lease 60 s y propietario UUID; actualizaciones finales condicionadas al propietario. Un worker caído se recupera tras vencer su lease. Petición al proveedor con timeout 10 s. El proceso suspendido puede reanudarse tras perder su lease: la clave estable del proveedor reduce duplicados, no elimina todos los riesgos externos.

Máximo 6 intentos de transporte. Fallos de red/timeout, HTTP 408/429/5xx y conflicto concurrent_idempotent_requests son temporales. Otros rechazos HTTP son permanentes; no se reintentan credenciales inválidas indefinidamente. Espera exponencial desde 30 s con factor aleatorio 0.5–1.5, techo base 1 h; Retry-After (segundos o fecha HTTP) actúa como espera mínima. Si la siguiente oportunidad supera el vencimiento, se descarta sin enviar. Los errores de cifrado o cuota no cuentan como intentos de transporte.

Se conservan cuotas de solicitud y cooldown por usuario/correo. La cuota global mail-global de 100/h se aplica al intentar entregar y es compartida con el transporte directo; reintentos también consumen esa cuota. Fallo del contador o cuota agotada aplaza una hora y no envía. La cola no renueva tokens ni requestedAt en cada reintento.

## Vigencia e idempotencia

Antes de enviar se comprueban vencimiento, usuario activo y hash vigente del token. Un token consumido, reemplazado por reenvío, o eliminado al verificar/cambiar contraseña deja su trabajo obsolete. Un fallo temporal conserva el token. Se valida nuevamente tras consultar la cuota para reducir carreras. No se puede retirar un correo ya aceptado ni hacer atómica una llamada externa con una escritura Mongo: si el usuario consume/reemplaza el enlace justo después del último chequeo, un correo en vuelo podría llegar, pero ese enlace ya será rechazado por la API. No se promete revocar envíos en vuelo.

Cada trabajo usa su UUID como Idempotency-Key en Resend, con el mismo cuerpo cifrado original en todos los reintentos (incluido from). Resend mantiene claves 24 h; aquí cada trabajo vence como máximo 23 h desde su creación, o antes si vence el enlace. Esto puede descartar una invitación en cola antes de sus 24 h de validez. Un timeout después de aceptación reintenta con la misma clave. No se promete entrega exactamente una vez ni confirmación de entrega final: la observabilidad de webhooks, rebotes y métricas ya se documenta en mail-observability.md; no representa lectura.

Referencia oficial: https://resend.com/changelog/idempotency-keys .

## Suspensión y desactivación

Si el alojamiento suspende el worker, no se envían correos hasta que vuelva. Trabajos y outbox permanecen; al reiniciar se recuperan leases y se descartan enlaces vencidos. Para una entrega oportuna se necesita un proceso worker con disponibilidad apropiada, que no se contrató ni configuró automáticamente.

Detener el worker no borra trabajos ni activa envío directo. MAIL_QUEUE_ENABLED=false impide que este worker procese; las NUEVAS solicitudes de la API vuelven al transporte directo si se cambia esa política manualmente, pero los trabajos ya pendientes no se drenan por otra vía. Para congelar pendientes sin cambiar la política, detener solo el proceso worker.

## API e interfaz

Registro con verificación requerida y reenvío/recuperación responden de forma genérica: “Si corresponde, la solicitud de correo quedó en cola…”, también para cuentas inexistentes o cooldown. No confirma existencia ni entrega. La invitación administrativa devuelve delivery: queued y mensaje de invitación en cola. Registro muestra el mensaje del servidor; recuperación, reenvío y administración ya lo presentan. Cambio de contraseña confirma el cambio, no afirma que se entregó el aviso.

## Comprobaciones aisladas

`node --test --test-concurrency=1 test/mail-queue.test.js test/security-policy.test.js test/email-security.test.js test/verification-pause.test.js`

MongoMemoryServer y transportes simulados: reinicio lógico antes/después de reconciliar, duplicados de outbox, concurrencia, recuperación de lease, timeout tras aceptación, clave estable, reenvío/consumo/vencimiento, Retry-After, máximo de intentos, rechazo permanente, privacidad y contraseña conservada ante fallo de aviso. `npm run build` en Frontend verifica compilación. No sustituyen pruebas con el proveedor en staging ni pruebas de disponibilidad del alojamiento.
