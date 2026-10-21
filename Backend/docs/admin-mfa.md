# Segundo factor administrativo

## Estado del piloto

Implementado: TOTP con OTPAuth, QR generado localmente por QRCode, recuperación de un solo uso, controles concurrentes, cifrado y auditoría básica. `ADMIN_MFA_REQUIRED=false` y `EMAIL_VERIFICATION_REQUIRED=false` permanecen como valores predeterminados. No hay inscripción automática ni cambio de rol. Sin claves nuevas, la aplicación funciona y Cuenta indica que MFA no está disponible para configurar.

La inscripción es exclusiva de administradores. Una cuenta inscrita siempre debe completar MFA al iniciar sesión, aunque después sea degradada de rol; la degradación no elimina protección. En ese caso la gestión de MFA requiere intervención operativa autorizada. Los representantes no inscritos conservan su acceso normal.

## Claves y configuración

Configurar exclusivamente en backend:

- `MFA_ENCRYPTION_KEYS`: objeto JSON `{ "v1": "<32 bytes aleatorios en base64>" }`.
- `MFA_ACTIVE_KEY_ID=v1`.
- Conservar `ADMIN_MFA_REQUIRED=false` durante pruebas.

Generar la clave con un generador criptográfico, por ejemplo `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` en una terminal privada. No pegar el resultado en chats, commits, tickets o plantillas. No reutilizar JWT_SECRET. Respaldarla en un gestor de secretos separado de MongoDB, con acceso limitado. Respaldo de base y versiones de claves deben poder restaurarse conjuntamente.

Los secretos se cifran con AES-256-GCM de Node, IV aleatorio y el ID del usuario como datos autenticados. El sobre incluye identificador de clave, IV, etiqueta y contenido cifrado. TOTP usa SHA-1, seis dígitos, 30 segundos y tolerancia de un intervalo; el contador consumido evita reutilización. Mantener sincronizado el reloj del servidor.

Rotación: añadir una nueva clave al objeto, cambiar el identificador activo y reiniciar; conservar claves antiguas para leer registros existentes. Las nuevas configuraciones usan la clave activa. **No hay migración masiva automática en esta versión.** Antes de retirar una clave antigua, cada cuenta correspondiente debe reinscribirse de forma controlada o pasar por una migración operativa revisada que recifre secretos activos y pendientes con control de versión. Mantener otra cuenta administrativa probada durante el proceso. Si hay obligatoriedad global, no desactivarla globalmente para rotar: mantener el llavero anterior hasta disponer de migración revisada.

Perder claves no desactiva MFA: falla el acceso protegido. No se sustituye la clave automáticamente ni se entregan sesiones sin segundo factor.

## API

Todas las rutas bajo `/api/auth` responden con `Cache-Control: no-store`. No registrar cuerpos de estos endpoints ni respuestas con QR/códigos.

| Ruta | Contrato |
|---|---|
| POST `/auth/login` | Si hay MFA activo: `{mfaRequired:true,challenge,expiresIn:300}`; no JWT ni perfil. Un nuevo login reemplaza el desafío anterior. |
| POST `/auth/mfa/login` | `{challenge,code}` → sesión completa. `code` admite seis dígitos TOTP o código de recuperación de 32 caracteres hexadecimales. |
| GET `/auth/mfa` | Admin autenticado: `{enabled,configured,recoveryRemaining,required}`. Nunca devuelve secretos ni códigos. |
| POST `/auth/mfa/setup` | Admin autenticado, `{currentPassword}` → `{secret,qr,expiresIn:600}`. QR como data URL local. No habilita MFA todavía. Reiniciar reemplaza la configuración pendiente. |
| POST `/auth/mfa/confirm` | `{code}` → `{recoveryCodes,reauthenticationRequired:true}`. Consume configuración pendiente, activa MFA y revoca sesiones. |
| POST `/auth/mfa/manage` | `{currentPassword,code,action:"regenerate"|"disable"}`. Regeneración devuelve nuevos códigos una sola vez, invalida los anteriores y revoca sesiones. Desactivación revoca sesiones y no devuelve códigos. Con obligatoriedad global no permite desactivar. |

Errores: 401 `MFA_INVALID` para código/desafío vencido, incorrecto o consumido; 403 para rol no autorizado; 409 para configuración ya activa o desactivación incompatible con política; 429 para exceso de intentos; 503 para clave ausente/no utilizable.

La sesión posterior a contraseña, cuando la política exige MFA pero aún no hay inscripción, lleva `mfaEnrollmentRequired:true`. El middleware solo permite GET de perfil propio/estado MFA y POST de configuración/confirmación; no permite editar perfil ni administrar contenido. Las cuentas ya inscritas nunca reciben esa sesión limitada: deben completar el desafío.

Los desafíos son aleatorios y se almacenan solo como hash. Vencen a los cinco minutos y están asociados a la versión de sesión. Hay cinco intentos por desafío/5 minutos y diez por cuenta/15 minutos, además de los límites actuales por conexión. Configuración y gestión tienen diez acciones por cuenta/15 minutos. Cambiar o recuperar contraseña invalida los desafíos anteriores por versión de sesión, pero no elimina MFA.

Los diez códigos de recuperación tienen 128 bits aleatorios cada uno, hashes SHA-256 y consumo atómico. La configuración pendiente vence en diez minutos; vencimiento siempre se verifica al usarla, sin depender de limpieza. No hay borrado programado nuevo. La auditoría conserva las últimas 100 acciones en el registro MFA, sin secretos, contraseña ni códigos. No sustituye una auditoría externa inmutable.

## Activación gradual sin perder acceso

1. Respaldar base y claves. Mantener pausa de correo y obligatoriedad MFA desactivada.
2. Configurar claves en un entorno aislado; ejecutar pruebas y comprobar una aplicación autenticadora real en una cuenta controlada.
3. Inscribir un administrador voluntariamente, guardar sus códigos fuera de la app y probar un nuevo login antes de cerrar cualquier acceso operativo adicional.
4. Preparar y comprobar una segunda cuenta administrativa autorizada y el procedimiento excepcional. No activar obligatoriedad global mientras el único administrador no tenga recuperación comprobada.
5. Solo después de autorización expresa, activar `ADMIN_MFA_REQUIRED=true`. No depende de exigir correo.

Cancelar la configuración visual descarta QR/clave del navegador; el pendiente cifrado queda inutilizable al vencer o al reemplazarlo. Los códigos no se recuperan con GET ni al recargar. Si se pierde la respuesta de confirmación, puede iniciarse sesión con la aplicación autenticadora y regenerarlos con contraseña y un código nuevo.

## Recuperación administrativa excepcional

No existe endpoint HTTP, contraseña maestra ni bypass público. Utilizar primero un código de recuperación. Si se perdieron todos los factores:

1. Un operador autorizado con acceso directo al entorno debe comprobar por un canal independiente quién solicita la recuperación; abrir un ticket con motivo, evidencia y aprobación de otra persona autorizada cuando exista.
2. Respaldar el registro y coordinar una ventana corta. Identificar la cuenta exacta y sus versiones actuales. No utilizar el correo verificado como única prueba de identidad.
3. Desde una consola operativa privada, ejecutar una transacción MongoDB con condiciones sobre `_id`, rol/estado actuales y `revision`: actualizar el registro MFA a `active:false`, vaciar `recoveryHashes`, eliminar `secret`, pendientes y desafío, incrementar `revision`; agregar en `history` una acción `exceptional-recovery:<ticket>`, fecha y `actor` del administrador autorizado. En la misma transacción incrementar `User.sessionVersion` y retirar `passwordReset`/`emailAction`. Si alguna condición no coincide, abortar y revisar; no aplicar actualizaciones incondicionales.
4. Conservar en el ticket la identidad del operador real y los IDs afectados. Si no existe otro administrador, documentar aprobación del responsable del proyecto; nunca inventar un actor. No escribir secretos en el ticket.
5. La persona recupera/cambia su contraseña por el flujo autorizado y vuelve a inscribir MFA. Si la política global está activa, solamente podrá configurar MFA hasta confirmarlo. Comprobar nuevo login y cerrar el ticket.

Esta operación es manual y exige autoridad sobre la base de datos; no se ejecutó sobre ninguna cuenta real.

## Pruebas y límites

- Backend: `node --test --test-concurrency=1 test/mfa.test.js test/security-policy.test.js test/verification-pause.test.js test/email-security.test.js test/account.test.js`.
- Frontend: `node test/mfa.cjs`; `npm run build`.
- MongoDB temporal, claves fijas únicamente de fixtures y correo simulado. No se usan datos ni envíos de producción.

Pendiente: WebAuthn/passkeys, dispositivos de confianza, auditoría centralizada, migración automática de claves y interfaz de recuperación excepcional. TOTP no es resistente al phishing como una passkey. La verificación de correo sigue sin demostrar identidad única.

Dependencias: [OTPAuth](https://github.com/hectorm/otpauth) para TOTP; QRCode genera imágenes locales sin enviar secretos a terceros. Auditoría ejecutada: cero avisos en dependencias de producción; tres avisos altos en la cadena de desarrollo nodemon/chokidar/braces. No se aplicó la degradación incompatible propuesta por `npm audit --force`.
