# Perfil, preferencias y Cuenta

La presentación personal permanece primero. Guardadas, visitas y eventos se conservan en el desplegable «Tu actividad en Koinonía». Las preferencias se agrupan con resúmenes de las respuestas; plegar un grupo no desmonta sus controles ni borra respuestas. La encuesta inicial conserva sus tres fases.

Contraseña y segundo factor se presentan bajo «Cuenta y seguridad». Recuperación de contraseña permanece en Inicio de sesión, fuera de Registro. No se modifican endpoints, validaciones ni políticas de seguridad del piloto.

Comprobaciones locales, sin cuentas de producción ni correos reales:

- `node Frontend/test/profile-layout.cjs`: API simulada; respuestas al plegar, teclado, foco, nombres largos, ausencia de avatar, lista vacía, errores junto al guardado, advertencia al salir y carga de MFA. Anchuras 320, 390 y 1440.
- `node Frontend/test/journey.cjs`: backend y MongoDB aislados; registro, tres fases, reanudación, preferencias, conflictos, cambio y recuperación de contraseña. Los avisos de correo no disponible son escenarios deliberados de la prueba.
- `node Frontend/test/mfa.cjs`: inscripción, códigos, login y regeneración de segundo factor.
- `node Frontend/test/motion.cjs`: desplegables, teclado y movimiento reducido.
- `npm --prefix Frontend run build`: compilación de producción.

Las pruebas de navegador usan Edge en Windows. Las capturas locales quedan en `Frontend/.cache/journey` y no forman parte del producto.
