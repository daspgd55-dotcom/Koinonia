# Mantenimiento seguro

El piloto mantiene SECURITY_CLEANUP_MODE=off. No se agregó un scheduler ni se ejecutó limpieza real. La simulación cuenta candidatos y escribe únicamente una auditoría. No existe implementación de eliminación de cuentas: SECURITY_ACCOUNT_DELETION_ENABLED admite solo false; true rechaza el arranque.

## Retenciones del servidor

| Variable | Predeterminado | Desde cuándo / alcance |
| --- | --- | --- |
| SECURITY_TOKEN_RETENTION_HOURS | 24 h | Después de vencer verificación, invitación o recuperación; retira solo hash |
| SECURITY_CHALLENGE_RETENTION_MINUTES | 60 min | Después de vencer inscripción/desafío MFA; preserva factor activo y recuperación |
| SECURITY_COUNTER_RETENTION_HOURS | 1 h | Después de terminar ventana del contador tradicional o de riesgo |
| SECURITY_CAPTCHA_RETENTION_HOURS | 24 h | Después de vencer el registro de uso; conserva ventana antirreutilización |
| SECURITY_MAIL_RETENTION_DAYS | 7 días | Después de terminar trabajo; mínimo 2 días, superior a ventana de idempotencia del proveedor |
| SECURITY_EVENT_RETENTION_DAYS | 7 días | Desde recepción del webhook; mínimo 7 días para deduplicación |
| SECURITY_AUDIT_RETENTION_DAYS | 90 días | Auditoría de ejecución de mantenimiento; mínimo 30 días |
| SECURITY_MAINTENANCE_BATCH_SIZE | 100 | Máximo 500 documentos por lote |
| SECURITY_MAINTENANCE_MAX_BATCHES | 20 | Máximo 100 lotes por ejecución |

Los rangos completos se validan en src/config/retention.js. Son retenciones mínimas, no plazos exactos de eliminación. Vencimiento lógico y purga física son independientes: las rutas de consumo, MFA, CAPTCHA y worker comprueban vigencia antes de aceptar/entregar. Un TTL retrasado nunca convierte un token vencido en válido.

Los TTL de contadores y usos de CAPTCHA se trasladan de expiresAt a purgeAt. Al conectar, retention-indexes.js reemplaza solo definiciones TTL obsoletas; no borra documentos ni índices de negocio. El TTL de MailJob tiene filtro para accepted/failed/obsolete: pending/processing/retry no se eliminan por antigüedad. Los registros históricos sin purgeAt se conservan hasta mantenimiento explícito. La retención nueva se aplica al escribir cada plazo; cambiar una variable no extiende retroactivamente plazos ya guardados. Revisar esos plazos antes de aumentar retenciones en producción.

SECURITY_CLEANUP_MODE=off detiene la aplicación por lotes, no desactiva los TTL operativos existentes. Tampoco detiene al worker de correo. El outbox cifrado y los trabajos activos se conservan si el worker está suspendido: al reanudar, este reconcilia y marca obsoleto lo vencido sin enviarlo. Los envíos directos interrumpidos sin estado terminal permanecen sin confirmar y requieren revisión; no se reenvían ni borran automáticamente.

## Ejecución y recuperación

Desde Backend: `npm run maintenance:security -- --dry-run`. Funciona con limpieza off y devuelve únicamente conteos, categorías y motivos. Para aplicar, revisar primero el resultado, habilitar SECURITY_CLEANUP_MODE=apply en el proceso servidor/CLI y ejecutar explícitamente `npm run maintenance:security -- --apply`. dry-run no permite aplicar. No hay ruta HTTP de aplicación ni configuración desde navegador.

Un lease compartido de 60 segundos excluye ejecuciones simultáneas. Cada lote renueva/comprueba propietario y vuelve a evaluar elegibilidad al mutar; un token renovado queda protegido. Se registra intención y resultado por lote, sin IDs de usuarios, hashes, correos, tokens ni payload. Tras una interrupción, la siguiente ejecución recupera el lease vencido y reevalúa candidatos. Los lotes son idempotentes; si hubo caída entre mutación y auditoría, los conteos pueden ser parciales y se indica interrupted. No se promete una transacción global sobre todas las colecciones. moreMayRemain indica que se alcanzó el máximo de lotes; ejecutar otra simulación.

Reversión: volver a off y detener el proceso CLI/scheduler externo, si se creó uno. Esto no recupera artefactos ya purgados ni revierte TTL. No restaurar tokens vencidos desde respaldos para hacerlos utilizables; emitir un enlace nuevo cuando corresponda. Respaldos y restauraciones requieren su política propia.

## Cuentas e invitaciones

Todas las cuentas están protegidas, independientemente de correo verificado, rol, actividad, contenido o asignaciones. La limpieza de hashes conserva la cuenta, permisos, emailVerifiedAt, metadatos de invitación y vínculos con iglesias. Una futura eliminación requiere un desarrollo y política independientes: revisión de dependencias, previsualización nominativa autorizada, consentimiento administrativo explícito y auditoría. No se considera implementada.

Panel Administración → Seguridad: simulación e invitaciones, exclusivo de admin.

| Ruta API | Contrato |
| --- | --- |
| POST /api/security/maintenance/simulate | Cuerpo vacío estricto; 5/h por admin; conteos/motivos, sin aplicar |
| GET /api/security/maintenance | Últimas 20 auditorías sin secretos |
| GET /api/security/invitations?page=1 | 20 pendientes por página: nombre, rol, estado, vencimiento, conteo de asignaciones; sin correo/token |
| POST /api/security/invitations/:id | action=resend o revoke; solo invitaciones de representante; cuotas/cooldown y auditoría |

Reenviar sustituye el token anterior y usa transporte configurado. Revocar elimina su hash, incrementa sessionVersion y mantiene invitationPending, cuenta y asignaciones. La revocación no puede deshacerse con el reenvío público. No hay reactivación de invitaciones revocadas en esta versión; requiere una política futura explícita. Auditoría embebida de invitación: máximo 50 acciones, conservadas mientras exista la cuenta; no guarda secretos. Auditoría de reintentos de correo: retención del trabajo, máximo 20 acciones. El panel de invitaciones muestra información nominativa mínima solo a administradores.

## Pruebas

`node --test --test-concurrency=1 test/maintenance.test.js test/verification-pause.test.js`

MongoDB efímero con monitor TTL desactivado para probar expiración independientemente de purga, simulación/aplicación, renovación, límites de lote, interrupción, leases simultáneos, migración de índices, protección de MFA/cuentas/asignaciones, invitaciones vencidas/revocadas y rechazo de aplicación desde HTTP. Ninguna prueba usa producción ni transporte real.
