# Revisión integral de seguridad — piloto

## Matriz de implementación y activación

| Mecanismo | Implementado | Política del piloto | Comprobación aislada | Pendiente externo |
| --- | --- | --- | --- | --- |
| Verificación y recuperación | Sí, enlaces con expiración y uso único | EMAIL_VERIFICATION_REQUIRED=false; recuperación disponible | Registro/login, invitaciones/provisional, expiración y concurrencia | Validación de entrega/dominio cuando se adopte |
| MFA administrativo | TOTP voluntario, cifrado, recuperación y desafío sin sesión completa | ADMIN_MFA_REQUIRED=false; quien lo inscribe sí lo exige | Inscripción, login, fuerza bruta, concurrencia, recuperación de contraseña sin omitir MFA | Llavero respaldado, prueba de recuperación operativa |
| Límites persistentes | Sí | Conservados | Concurrencia, redes compartidas, API directa | Protección volumétrica de infraestructura |
| Abuso distribuido | Detección y observación; aplicación avanzada aún reservada | ADVANCED_ABUSE_MODE=observe | IP rotativas, varias instancias, volumen global, fallo de almacenamiento | Afinar umbrales y construir aplicación antes de enforce |
| CAPTCHA adaptativo | Turnstile reemplazable | CAPTCHA_MODE=off | Tokens inválidos, repetidos, vencidos, proveedor caído, formulario conservado | Claves/hostname y prueba controlada del proveedor |
| Cola de correo | Outbox cifrado, leases, reintentos e idempotencia | MAIL_QUEUE_ENABLED=false; transporte directo conservado | Caídas, duplicados, expiración, timeout tras aceptación | Llavero y worker disponible |
| Observabilidad/webhooks | Firma original, deduplicación, panel admin | No se configuró un webhook externo | Firmas, desorden, privacidad, permisos, reintentos | Registrar webhook y validar entrega real |
| Mantenimiento de artefactos | Simulación y aplicación CLI por lotes | SECURITY_CLEANUP_MODE=off | Conteos, lotes, interrupción, concurrencia, protección de datos | Revisar retenciones y programar solo tras aprobación |
| Eliminación de cuentas | No implementada deliberadamente | Deshabilitada; true rechaza arranque | Cuentas y asignaciones preservadas | Política independiente y autorización futura |

Esta matriz describe valores predeterminados y pruebas locales; no certifica variables ni disponibilidad del despliegue de Render. No se modificó el .env real, no se enviaron correos reales y no se hicieron commit, push ni despliegue.

## Activación gradual y reversión

1. Respaldar secretos fuera de MongoDB y probar restauración en entorno aislado. Revisar retenciones/TTL antes de desplegar. Registrar métricas de referencia y acceso administrativo de recuperación.
2. Verificación: mantener false durante piloto. Más adelante preparar proveedor/dominio e invitaciones antes de true. Volver a false conserva emailVerifiedAt y no borra cuentas. No fabricar verificaciones para facilitar pruebas.
3. MFA: preparar llavero exclusivo y probar inscripción voluntaria y códigos guardados antes de ADMIN_MFA_REQUIRED=true. Evitar exigirlo sin haber probado acceso del último admin. Revertir a false elimina obligación global, pero NO desactiva MFA inscrito. Procedimiento excepcional auditado: admin-mfa.md.
4. CAPTCHA: claves completas, hostname y acción configurados; pasar primero por observe, luego enforce con pruebas controladas. Volver a observe/off no quita límites existentes. Enforce incompleto falla al iniciar; proveedor indisponible no permite saltar desafío requerido.
5. Abuso avanzado: observe registra decisiones sin nuevos bloqueos, off detiene esa observación. enforce permanece rechazado hasta implementar y validar su política. Nunca usar esta variable para quitar cuotas tradicionales.
6. Cola: preparar llavero en API/worker, activar MAIL_QUEUE_ENABLED y arrancar worker independiente. Para pausar entrega, detener worker. Volver a false afecta nuevas solicitudes; no drena trabajos antiguos por envío directo. Preservar claves antiguas hasta vaciar outbox/trabajos.
7. Webhook: registrar URL/firma según mail-observability.md; sin seguimiento de aperturas. Para desactivar, retirar webhook del proveedor y secreto del servidor; registros existentes siguen retenidos, no se pierde la política de autenticación.
8. Mantenimiento: dry-run, revisión de conteos y luego aplicación explícita en CLI con apply. Volver a off impide aplicar lotes; TTL operativos continúan. La eliminación es irreversible sin respaldo; nunca incluye cuentas. Ver security-maintenance.md.

## Evidencia y límites de la revisión

Backend: `node --test --test-concurrency=1 test/mfa.test.js test/captcha.test.js test/abuse-risk.test.js test/email-security.test.js test/mail-queue.test.js test/mail-observability.test.js test/maintenance.test.js test/security-policy.test.js test/verification-pause.test.js test/account.test.js`.

Frontend: `node test/mfa.cjs`, `node test/captcha.cjs`, `node test/security-mail.cjs`, `npm run build`.

Las pruebas usan bases efímeras y adaptadores simulados. Cubren registro, login, edición de iglesia por representante no verificado, creación provisional/invitada, recuperación que conserva MFA, políticas no modificables mediante HTTP, proyecciones privadas, errores sin tokens y permisos del panel. La revisión de logs de estos recorridos muestra códigos genéricos de fallos simulados; no registra cuerpos del proveedor ni claves. No equivale a una auditoría externa, pentest volumétrico ni garantía de ausencia absoluta de vulnerabilidades. Una cuenta por persona no puede garantizarse verificando correo.

Resultado local: batería inicial de 51 pruebas aprobadas; después se añadió exclusión simultánea/HTTP y se repitieron las 5 pruebas de mantenimiento, todas aprobadas (52 casos distintos). Tres recorridos de navegador aprobados: MFA, CAPTCHA y panel de correo/mantenimiento móvil. Compilación de producción del frontend aprobada. No se ejecutó la limpieza contra la base del piloto.
