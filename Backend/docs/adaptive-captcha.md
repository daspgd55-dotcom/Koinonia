# CAPTCHA adaptativo

## Estado y activación manual

Implementado pero `CAPTCHA_MODE=off` por defecto. `EMAIL_VERIFICATION_REQUIRED=false` conserva la pausa. No se activaron servicios, claves ni políticas en producción.

1. Crear manualmente un widget Turnstile Managed en Cloudflare y autorizar únicamente los hostnames del frontend que controlas (por ejemplo el subdominio onrender.com, sin esquema ni ruta). No necesitas adquirir un dominio para preparar el widget.
2. Configurar solo en el backend TURNSTILE_SITE_KEY (pública), TURNSTILE_SECRET_KEY (secreta) y TURNSTILE_HOSTNAMES (lista separada por comas). No usar prefijos VITE para secretos. Conservar las claves fuera de Git y de logs. Restringir también los dominios en Cloudflare.
3. Mantener ADVANCED_ABUSE_MODE=observe. Probar CAPTCHA_MODE=observe: no requiere claves, no carga widget y registra decisiones hipotéticas muestreadas a una por minuto/proceso. Revisar falsos positivos y umbrales antes de exigir desafíos.
4. En entorno aislado configurar claves reales de staging y comprobar integración. Las pruebas automatizadas usan un adaptador y widget simulados; no hay parámetro HTTP ni bypass público. Las claves oficiales dummy solo sirven en entornos aislados; producción rechaza sus prefijos conocidos. Las validaciones estrictas de acción/hostname siguen activas, por lo que se recomienda el adaptador simulado para pruebas unitarias.
5. Solo cuando se decida activar: CAPTCHA_MODE=enforce y reiniciar. Configuración incompleta o riesgo desactivado impiden arrancar. Conservar EMAIL_VERIFICATION_REQUIRED=false mientras siga el piloto. Para retirar únicamente CAPTCHA, volver a off: no apaga cuotas ni MFA.
6. Si el hosting define CSP, permitir https://challenges.cloudflare.com en script-src y frame-src; revisar las recomendaciones oficiales de CSP. La aplicación React carga el script solo al requerirse un desafío. No se modificó la infraestructura ni la política del hosting.

## Contrato

POST /api/auth/register, login, forgot-password, reset-password, resend-verification (incluye invitaciones), verify-email y accept-invitation. El riesgo se calcula en el servidor; ninguna cabecera del cliente cambia la decisión. En enforce, riesgo captcha o unknown exige desafío. Un fallo de contadores nunca degrada silenciosamente la decisión a acceso libre. Riesgo allow/monitor conserva flujo normal. Se observa volumen, no existencia de cuentas.

403 CAPTCHA_REQUIRED incluye error.details.captcha = {provider:"turnstile",siteKey,action}. El frontend muestra un diálogo accesible y reenvía la misma operación con cabecera X-Captcha-Token. No se añade el token al JSON de negocio, almacenamiento del navegador ni URL. No hay endpoint de aprobación independiente ni pase permanente. Las respuestas de recuperación/reenvío conservan su comportamiento genérico existente. No se modificó el comportamiento de registro durante la pausa de verificación.

El adaptador `turnstile(config).verify(token)` consulta Siteverify desde el servidor, con plazo de 5 s. Valida success===true, timestamp de hasta 300 s (tolerancia futura 30 s), acción exacta del endpoint y hostname en lista cerrada del servidor. No confía en Origin/Host del solicitante para validar hostname. No envía IP, contraseña ni correo al adaptador. Turnstile valida su token criptográficamente; adicionalmente CaptchaUse registra únicamente SHA-256 del token aprobado, con unicidad atómica y TTL de 10 min. Dos instancias no pueden consumir el mismo token. Se conserva la colección hasta más allá de la vigencia del token.

Token ausente/inválido/vencido/reutilizado: 403 genérico, permite renovar. Proveedor, almacenamiento de consumo o conexión fallidos: 503 CAPTCHA_UNAVAILABLE, no ejecuta operación. Nunca se omiten cuotas existentes; CAPTCHA se aplica después de límites generales y antes del controlador, sin reiniciar sus contadores. Si el controlador falla después de consumir CAPTCHA se necesita token nuevo para el siguiente intento requerido.

## Interfaz y privacidad

El diálogo modal usa controles de teclado, Escape para cancelar, estado aria-live, formato adaptable y acciones Renovar/Continuar/Volver al formulario. Los datos permanecen en el formulario y en memoria durante la comprobación; no se guardan contraseñas ni pruebas CAPTCHA en storage. Navegar cancela el desafío pendiente. Hasta tres desafíos automáticos por envío; después se muestra error y el usuario puede intentar nuevamente. Un 503 muestra error conservando los campos, sin reintentar la operación a ciegas.

Turnstile ejecuta comprobaciones del proveedor: no implica una persona única ni elimina el abuso. La aplicación no añade seguimiento de dispositivo propio. El script y servicio externo no se han verificado con claves reales en este trabajo; la activación manual debe incluir esa prueba.

## Pruebas

Backend: `node --test --test-concurrency=1 test/captcha.test.js test/security-policy.test.js test/verification-pause.test.js test/abuse-risk.test.js test/mfa.test.js`.
Frontend: `node test/captcha.cjs` y `npm run build`.
Usan MongoMemoryServer, adaptador simulado y respuestas de navegador interceptadas; ninguna cuenta real ni correo externo. La prueba de navegador cubre registro, login, recuperación y reenvío, expiración, error, renovación, cancelación con Escape y conservación de campos en móvil.

Referencias oficiales: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ y https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/ .
