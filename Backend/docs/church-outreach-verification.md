# Verificación de invitaciones dirigidas — 2026-11-03

## Entorno y límites

Se revisó el checkout y su estado de Git antes de editar. Se conservaron los cambios previos. No se consultó producción, no se leyó su configuración, no se enviaron correos, ni se hizo commit, push o despliegue.

La suite nueva usa MongoMemoryReplSet (MongoDB 8.0.12), base `outreach_isolated_<uuid>` y URI local comprobada antes de limpiar datos. No carga `.env`. El transporte está sustituido por funciones simuladas; los accesos fetch externos fallan deliberadamente. Los textos legales ficticios se inyectan únicamente en el proceso de pruebas y se restauran. La configuración legal del producto sigue pendiente.

El recorrido visual usa Edge Chromium headless, Vite temporal y backend local. Bloquea recursos ajenos a localhost. Las direcciones son `example.test`. No inicia el worker real. Al terminar comprueba cero trabajos de correo y cero errores JavaScript de página.

## Ejecuciones

Desde `Backend`:

```powershell
node --test --test-concurrency=1 test/mail-queue.test.js test/mail-observability.test.js test/church-subroles.test.js test/mfa.test.js test/verification-pause.test.js
node --test --test-concurrency=1 --test-reporter=spec --test-reporter-destination=../outputs/invitaciones-verificacion/backend-outreach.txt test/church-outreach.test.js
```

Regresión existente: **28/28**, cero fallos (66,429 s). Suite dirigida: **26/26**, cero fallos (19,879 s). Véase el resultado final reproducible en `outputs/invitaciones-verificacion/backend-outreach.txt`.

Desde `Frontend`:

```powershell
node test/outreach.cjs
npm.cmd run build
```

Navegador: **6 recorridos completados**, cero errores de página y cero trabajos de correo. Resoluciones 1440×1000, 390×844 y 1280×900; movimiento reducido y normal. Build final: **correcto**, 138 módulos, Vite 7.3.6, 4,65 s. Se ejecutó también un build inicial correcto antes de las correcciones.

Los primeros intentos de MongoDB dentro del sandbox fallaron por restricciones de localhost/arranque (`EACCES`, `fassert`); se repitieron con permiso para procesos locales aislados. No fueron resultados funcionales aprobados. Las iteraciones detectaron el error de campos inmutables y el cooldown de correo individual. El navegador tuvo además un fallo del selector de prueba por dos enlaces «Crear cuenta»; se acotó al contenido principal.

## Cobertura

| Área | Comprobaciones realizadas |
| --- | --- |
| Acceso privado | GET sin consumo/respuesta, token manipulado, propósito incorrecto, destino inyectado, reutilización, vencimiento, revocación, renovación de enlace y sesión, cuotas y concurrencia al iniciar |
| Respuesta | Iglesia/contacto incorrectos, rechazo y no contacto; coordinador externo al equipo; correo inicial compartido con representante; duplicados; consentimiento y bloqueo sin textos legales |
| Revisión | Permiso admin, versiones concurrentes, doble aprobación idempotente, cambios de payload, destino cambiado, requisito de administrador y límite de equipo |
| Aceptación | Cuenta habitual nueva y existente, correo destinatario, verificación y MFA, vencimiento/rechazo/revocación, aceptación concurrente, subroles y conservación del equipo anterior |
| Church | Conservación de publicación, actividad, verificación y relaciones existentes; no creación de iglesia; registros anteriores conservados |
| Correo | Preparación/vista previa/simulación, digest y cuotas, idempotencia, token cifrado, reintentos y límite de fallos, cancelación por token revocado/no contacto, bloqueo cuando deshabilitado |
| Entrega | Aceptación del proveedor separada de entrega; webhook firmado simulado; apertura ignorada; rebote permanente y exclusiones |
| Recordatorios | Plazo mínimo, máximo de dos, parada ante respuesta y no contacto incluso mediante ficha fusionada; exclusión de datos de prueba |
| Interfaz | Retroceso y error 503 sin perder respuestas; casillas legibles; teclado Enter/Espacio; foco; movimiento reducido; ausencia de desbordamiento; borrador administrativo conservado ante conflicto; selección y simulación sin encolado; registro, aceptación y reingreso a iglesia correcta |

La cobertura de teclado incluye acciones concretas del recorrido, no una auditoría completa con lector de pantalla. No se certifican otros navegadores, dispositivos físicos, entregabilidad de Resend, configuración de Render ni comportamiento bajo carga sostenida. La suite de MFA existente ejercita TOTP; el caso dirigido comprueba también el bloqueo del middleware y la sesión con segundo factor.

## Correcciones

1. Defaults de campos inmutables en invitación, miembro y evento: se aplican sólo a documentos nuevos. Mongoose impedía hidratar/guardar los existentes; se conserva la inmutabilidad.
2. Correo individual: su cooldown usa la emisión individual y no la del enlace institucional.
3. Función propuesta: etiqueta asociada al select y explicación separada mediante `aria-describedby`.
4. Encabezados: se neutraliza el fondo global de navegación en formulario y administración; títulos nuevamente legibles. Indicadores móviles de pasos mantienen ancho circular.
5. Inicio público: conduce al recorrido dirigido. Se conserva la ruta directa de inscripción anterior, sus APIs y sus registros.

También se ejecutó `git diff --check` desde la raíz: salida vacía, código 0. Este comando cubre los cambios rastreados por Git; los archivos nuevos fueron ejercitados por las suites y la compilación descritas.

## Evidencias

`outputs/invitaciones-verificacion/ui-results.json` contiene los seis recorridos. Las capturas en esa carpeta muestran formulario, revisión móvil, administración, simulación, aceptación y bloqueo legal. `vista-previa-sintetica.json` contiene el correo inicial renderizado, exclusiones y capacidades; no contiene token utilizable ni destinatario real. Las capturas son evidencia de pruebas con textos ficticios, no textos legales para publicar.

## Corrección posterior del recorrido público
Por aclaración del usuario, se restauró el apartado público de inscripción. Las invitaciones dirigidas quedan sin enlace en el inicio. Se actualizó la expectativa correspondiente del recorrido de navegador; no se volvió a ejecutar la suite en esta corrección. Los resultados anteriores describen la versión verificada antes de esta aclaración.
