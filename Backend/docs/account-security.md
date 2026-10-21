# Seguridad de cuentas: primera versión

## Pausa durante el piloto (estado actual)

`EMAIL_VERIFICATION_REQUIRED=false` es el valor predeterminado. Pausa las restricciones de acceso por correo, incluso si `ENFORCE_LEGACY_EMAIL_VERIFICATION=true`, pero conserva cuotas, permisos por rol/asignación, expiración de sesiones y contraseñas con hash. No cambia `emailVerifiedAt` ni borra datos. Los registros nuevos responden 201 con perfil y pueden iniciar sesión sin correo.

Durante la pausa, `POST /api/representatives` acepta `password` opcional (8 caracteres mínimo). Si se proporciona, crea una cuenta utilizable sin enviar correo ni devolver la clave. Si falta o está vacía, mantiene la invitación y exige proveedor configurado. Las invitaciones existentes sin contraseña elegida siguen necesitando aceptación: no se inventa una clave accesible ni se habilita autenticación sin contraseña.

`GET /api/auth/capabilities` indica `emailVerificationRequired` y `representativePasswordAllowed` para adaptar la interfaz. Se retiraron el enlace permanente de verificación en registro/login y el recordatorio global. El enlace solo aparece tras un registro pendiente, bloqueo efectivo o invitación.

Para retomar el modo estricto descrito debajo, configurar `EMAIL_VERIFICATION_REQUIRED=true`; para incluir todas las cuentas antiguas, también `ENFORCE_LEGACY_EMAIL_VERIFICATION=true`. Antes verificar entrega y acceso del administrador. Prueba de pausa: `node --test test/verification-pause.test.js`.

Las siguientes secciones describen el modo estricto y la infraestructura que permanece disponible.

## Comportamiento del modo estricto (no activo por defecto)

Los nuevos registros de la aplicación requieren verificar el correo. No se emite sesión hasta entonces; el middleware también bloquea sesiones de cuentas pendientes en todas las rutas autenticadas. Las páginas públicas siguen disponibles. La verificación prueba control del buzón, no identidad civil ni unicidad de una persona.

El registro devuelve una respuesta genérica tanto para correos nuevos como existentes; no sobrescribe contraseña, rol o nombre de una cuenta existente. El enlace de verificación requiere la contraseña de la cuenta: abrirlo accidentalmente no activa una cuenta que otra persona hubiera creado con una contraseña desconocida. Si el propietario desconoce esa contraseña, la recuperación le permite establecer una nueva y verificar el correo de forma segura.

Los representantes nuevos se crean por invitación. El administrador puede asignarles iglesias mientras están pendientes, pero no pueden acceder hasta aceptar la invitación y definir su contraseña. Nunca se entrega una contraseña inicial al administrador. Las cuentas existentes se promocionan mediante el control actual; una promoción no verifica el correo.

## Configuración y activación gradual

Configurar en el backend, nunca en VITE:

- `RESEND_API_KEY`: clave del proveedor.
- `MAIL_FROM`: remitente autorizado por el proveedor.
- `APP_PUBLIC_URL`: origen HTTPS del frontend sin barra final. Los enlaces se construyen desde esta configuración, nunca desde Host enviado por el cliente.
- `ENFORCE_LEGACY_EMAIL_VERIFICATION=false`: transición inicial de cuentas existentes.

Con correo ausente, registro nuevo, recuperación e invitaciones responden 503; no se habilitan cuentas sin verificar como alternativa. El inicio de sesión de cuentas anteriores sigue operativo durante la transición. No hay cambios ni borrados de cuentas por migración automática.

1. Configurar el proveedor y probar entrega a un buzón controlado, spam y enlaces desde otro dispositivo.
2. Verificar al menos una cuenta administrativa desde «Verificar correo». No se muestra un recordatorio global. El administrador puede consultar el estado en gestión de usuarios.
3. Confirmar recuperación y acceso del administrador.
4. Establecer `EMAIL_VERIFICATION_REQUIRED=true` y, cuando corresponda incluir cuentas antiguas, `ENFORCE_LEGACY_EMAIL_VERIFICATION=true`; reiniciar. Desde entonces toda cuenta no verificada, incluso con JWT antiguo o rol admin, debe verificar. No existe exención de rol. Arrancar con verificación obligatoria sin correo configurado falla explícitamente, también sin imponerla al legado.

La producción carga `requireVerifiedEmail:true`, pero `verificationPaused:true` suspende la exigencia de correo mientras conserva las cuotas. La opción inyectable `requireVerifiedEmail:false` solo se usa en fixtures locales de regresión que necesitan crear cuentas con el contrato anterior; no tiene variable de entorno ni control HTTP. Las suites email-security usan el comportamiento seguro real.

## API del modo estricto (excepciones del piloto indicadas arriba)

| Método/ruta | Contrato |
|---|---|
| POST `/api/auth/register` | `{email,password,name?}` → 202 `{verificationRequired:true,message}`; sin JWT, perfil ni contraseña devuelta. |
| POST `/api/auth/resend-verification` | `{email}` → 200 genérico. Reenvía verificación o invitación según estado; no activa cuentas. |
| POST `/api/auth/verify-email` | `{token,password}` → 200. Enlace de 1 hora, un solo uso. Invalida sesiones y enlaces de recuperación previos. |
| POST `/api/auth/accept-invitation` | `{token,newPassword}` → 200. Enlace de 24 horas; activa correo y contraseña, sin modificar rol ni asignaciones. |
| POST `/api/auth/login` | Credenciales válidas con verificación pendiente → 403 `EMAIL_VERIFICATION_REQUIRED`. Credenciales incorrectas → 401 genérico. |
| POST `/api/representatives` | Solo admin: `{name,email,position}` → 201 con datos básicos, `delivery:sent|failed` y mensaje. Rechaza `password` y roles enviados. Cuenta existente → 409. |
| POST `/api/auth/forgot-password` | `{email}` → respuesta genérica, incluso si no existe, hay cooldown o falla la entrega. No restablece invitaciones pendientes: reenviar invitación. |
| POST `/api/auth/reset-password` | `{token,newPassword}`; enlace de 30 minutos, un solo uso. Verifica el correo, invalida sesiones y enlaces de verificación anteriores. |
| POST `/api/auth/change-password` | Autenticado: `{currentPassword,newPassword}`. Exige contraseña actual, cambia con control concurrente y cierra sesiones. |

`emailVerified` es un booleano del perfil propio. La lista administrativa incluye `emailVerifiedAt` e `invitationPending`, sin tokens. Un fallo de invitación no borra la cuenta: puede reenviarse desde el panel o la página de verificación. El emisor original se registra en `invitedBy`; la acción conserva `issuedBy` mientras está pendiente.

Las páginas web son `#/verificar-correo`, `#/verificar-correo?token=…`, `#/aceptar-invitacion?token=…` y las rutas de recuperación existentes. GET no consume enlaces; se requiere enviar un formulario. No se guardan tokens en almacenamiento local y se retiran del historial actual tras éxito.

## Límites y seguridad

- 60 acciones de autenticación / conexión / 15 minutos; 10 registros / conexión / hora.
- 20 intentos de inicio de sesión / correo / 15 minutos.
- 5 solicitudes de enlace / dirección / hora compartidas entre registro, reenvío y recuperación; espera de 60 segundos por tipo de enlace.
- 20 invitaciones / administrador / hora; 100 intentos de envío totales / hora como límite inicial del piloto.
- 5 cambios de contraseña / cuenta / 15 minutos; 8 intentos de contraseña por enlace de verificación / hora.

Cuotas por ventanas fijas, atómicas y persistentes en MongoDB, con claves HMAC (sin guardar correo/IP en claro) y borrado por TTL. No sustituyen protección de red ni un CAPTCHA frente a ataques distribuidos. Una red compartida puede agotar su cuota temporal: ajustar tras observar el piloto. `TRUST_PROXY_HOPS` debe reflejar únicamente los proxies reales; no confiar indiscriminadamente en X-Forwarded-For.

Tokens aleatorios de 256 bits, guardados como SHA-256, separados por finalidad y consumidos con una actualización condicional atómica. Expiración comprobada al consumir, no dependiente de limpieza TTL. Los reenvíos invalidan el enlace anterior. En modo directo, los fallos de entrega invalidan el token y conservan el cooldown; en cola, un fallo temporal conserva el token para reintentar. Los logs registran únicamente códigos de error. Contraseñas con bcrypt y revocación por sessionVersion. Respuestas de autenticación no almacenables.

Se intenta enviar un aviso después de cambiar o recuperar contraseña. Un fallo de ese aviso no revierte el cambio de seguridad; el piloto conserva envío directo, y la cola persistente opcional permite reintentos sin garantizar entrega final (ver mail-queue.md). Los registros pendientes se conservan; no se declara un borrado automático de cuentas.

## Verificación

- `cd Backend; node --test --test-concurrency=1 test/email-security.test.js test/account.test.js test/api.test.js`
- `cd Frontend; node test/email-security.cjs`
- `cd Frontend; npm run build`

Se utiliza MongoDB temporal y correo simulado: ninguna cuenta real ni envío externo. Se prueban autorización, cuentas pendientes, enlaces vencidos/reutilizados, concurrencia, recuperación, aviso de contraseña, privacidad, invitaciones, fallo del proveedor y transición de legado. La entrega real exige la configuración anterior y una prueba manual controlada.

Disponible: segundo factor administrativo voluntario (ver [MFA](admin-mfa.md)). Disponibles sin activación obligatoria: CAPTCHA adaptativo, cola de correo con reintentos y observación de abuso distribuido. Disponible: observabilidad de correo y panel administrativo (mail-observability.md). Disponible: mantenimiento de artefactos e invitaciones (security-maintenance.md). Pendiente: protección volumétrica externa. Verificar correo no permite prometer «una cuenta por persona».


## Base de políticas independientes

Todas las variables siguientes se leen exclusivamente en el servidor al arrancar. No existe endpoint de escritura ni bypass mediante cabeceras, query o navegador. Los valores inválidos se rechazan sin imprimir su contenido. La política nueva es inmutable durante la ejecución; cambiarla exige reiniciar. `/auth/capabilities` mantiene solamente los dos booleanos públicos existentes, sin publicar políticas internas ni secretos.

| Variable | Predeterminado | Valores y estado real |
|---|---|---|
| `ADMIN_MFA_REQUIRED` | `false` | MFA disponible; `true` exige claves válidas y restringe al administrador no inscrito a la configuración |
| `CAPTCHA_MODE` | `off` | `off`, `observe`, `enforce` con Turnstile y riesgo configurados; ver adaptive-captcha.md |
| `MAIL_QUEUE_ENABLED` | `false` | `true` activa outbox; requiere correo y claves de cifrado. Worker separado: mail-queue.md |
| `ADVANCED_ABUSE_MODE` | `observe` | `off`, `observe`; `enforce` rechaza arranque |
| `SECURITY_CLEANUP_MODE` | `off` | `dry-run` y `apply` disponibles mediante ejecución explícita; nunca eliminan cuentas |

Los modos desactivados no requieren claves de MFA/CAPTCHA/cola. Abuso avanzado obligatorio continúa reservado; el mantenimiento ya dispone de simulación y aplicación por lotes. La cola ya está implementada, desactivada por defecto; ver mail-queue.md. CAPTCHA adaptativo ya está implementado; su aplicación sigue desactivada y su activación exige configuración completa (ver adaptive-captcha.md). MFA ya valida claves y permite inscripción voluntaria sin activar su obligatoriedad. Las cuotas actuales nunca dependen de estas variables. Los contadores separan vencimiento lógico y retención física; ver security-maintenance.md.

`security-observation.service.js` ofrece `observeDecision` para futuros detectores del servidor. En `observe` registra únicamente control y decisión hipotética; nunca rechaza solicitudes. En `off` no registra. Los errores del destino de registro no añaden bloqueos. La detección de volumen distribuido ya está conectada en observación; consulta [abuse-observation.md](abuse-observation.md) para umbrales, precisión y límites. El panel administrativo permite simular limpieza sin borrar artefactos; su aplicación solo existe en CLI.

`EMAIL_VERIFICATION_REQUIRED` y `ENFORCE_LEGACY_EMAIL_VERIFICATION` aceptan exclusivamente `true` o `false`; ausencia equivale a `false`. Se preserva el piloto y no se modifica ninguna cuenta. No se migra ni borra `emailVerifiedAt`. Configurar correo parcialmente sigue siendo un error de configuración del servicio de correo existente.

Pruebas aisladas: `node --test test/security-policy.test.js test/verification-pause.test.js test/email-security.test.js test/account.test.js`. Las pruebas inyectan configuración, base temporal y correo simulado: nunca necesitan el `.env` real ni envían mensajes externos. No activar las nuevas políticas en Render en esta etapa.

Revisión integral, matriz del piloto y reversión: [security-review.md](security-review.md).
