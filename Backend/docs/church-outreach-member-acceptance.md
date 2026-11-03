# Aprobación y aceptación individual — etapa 5

Implementada sin ejecutar pruebas, build, servidor ni envíos. Requiere MongoDB con transacciones e índices inicializados por el arranque habitual. No se operó sobre producción.

## Aprobación administrativa

POST `/api/church-outreach-invitations/:id/review` conserva autenticación de admin global, `If-Match` y motivo obligatorio. Añade cabecera obligatoria `Idempotency-Key` UUID. Cada decisión de people acepta `changeExistingRole` boolean, predeterminado false.

Una sola transacción registra decisiones, prepara `ChurchOutreachMember`, revoca accesos institucionales obsoletos y guarda auditoría. La combinación ciclo+correo es única. Solo puede haber una invitación individual activa por iglesia+correo, aun entre ciclos. Aprobar no crea User, no genera contraseñas y no asigna representación. El contacto coordinador no tiene que integrar el equipo ni ser administrador.

La clave de operación queda ligada al actor, ciclo y hash del cuerpo normalizado + versión. Repetir exactamente la operación devuelve la invitación actual sin aplicar otra decisión ni duplicar eventos. Reutilizar la clave con otro contenido se rechaza. El cliente conserva la clave en su borrador ante un error de red; una edición o cambio de versión crea otra. La clave y su hash no contienen tokens de acceso.

Se preservan funciones de usuarios ya asignados, incluidas las asignaciones antiguas cuyo subrol implícito es administrator. Si el admin marca expresamente changeExistingRole, se prepara el cambio solicitado y se documentan motivo, función solicitada y función efectiva. No se aplica hasta que acepte la cuenta destinataria. Si la asignación previa cambió entretanto, se exige revisar de nuevo. Personas ya aceptadas en ese ciclo se gestionan desde Equipo; no se reescribe una aceptación histórica.

## Administración válida y capacidad

Se cuenta como administración válida una cuenta activa, con rol representative/admin, asignada al equipo como administrator (explícita o legado), sin invitationPending ni bloqueo de verificación bajo la política vigente. Se mantiene la autenticación/MFA normal al aceptar y al usar la administración.

La preparación comprueba el equipo existente y las invitaciones pendientes de la misma iglesia: máximo 20 personas, contando correos ya presentes solo una vez. Un bloqueo transaccional por iglesia serializa las operaciones de este flujo; los cambios del editor general también se detectan mediante la versión optimista de Church al aceptar.

Si una aprobación dejaría el conjunto propuesto sin administración válida, exige aprobar al menos un administrador. La aceptación de una persona no administradora se bloquea con FIRST_ADMIN_REQUIRED mientras no exista administración válida. No consume su invitación: puede consultar e intentar después. El primer administrador se asigna atómicamente antes de que se permita el resto. Una degradación deliberada del último administrador también se bloquea hasta que otro administrador válido exista.

Rechazar, declinar, revocar o dejar vencer al candidato administrador no obliga a conceder acceso: los demás quedan pendientes hasta una revisión/reemplazo administrativo. La validez se evalúa en cada operación; no garantiza que otro sistema nunca desactive posteriormente una cuenta o cambie una política.

## Enlaces y estados

`ChurchOutreachMember`: iglesia/ciclo/correo inmutables, función efectiva, política de cambio y asignación previa esperada, aprobador/motivo/fecha, propósito church_team_acceptance, estado, vencimiento, hash de token y datos de aceptación. Estados prepared, pending, accepted, declined, revoked, expired. El vencimiento se aplica al consultar/actuar, sin depender de TTL; la bandeja también muestra effectiveState=expired.

| Ruta POST | Permiso / cuerpo | Efecto |
| --- | --- | --- |
| `/api/church-outreach-invitations/:id/member-link` | admin, If-Match, `{email}` | Genera o renueva enlace para persona aprobada; devuelve path, expiresAt, version, delivery=not_sent. |
| `/api/church-outreach-invitations/:id/member-revoke` | admin, If-Match, `{email,reason}` | Revoca invitación no aceptada; conserva accesos previos. |
| `/api/church-outreach-members/inspect` | sesión habitual, `{token}` | Consulta solo si el correo de la cuenta coincide. No acepta ni consume. |
| `/api/church-outreach-members/respond` | sesión habitual, `{token,answer:"accept" o "decline"}` | Respuesta explícita transaccional. |

Token aleatorio de 32 bytes, persistido solo como SHA-256, hasta 7 días y nunca más allá del ciclo. Renovar reemplaza el hash; un token anterior deja de servir. Cuotas persistentes: 30 emisiones/admin/hora y 5/correo/día, con mínimo 60 segundos entre emisiones. Respuestas: 40/IP/15 minutos, 30/cuenta/15 minutos, 15/token/15 minutos. No hay GET que cambie una invitación. No se envían correos: la interfaz muestra el enlace personal al administrador mediante una acción explícita. El transporte queda pendiente.

Una invitación individual vencida/rechazada/revocada requiere reaprobar antes de emitir otro enlace. Un ciclo vencido requiere preparar otro ciclo. Cerrar/revocar/no contacto en el ciclo institucional invalida invitaciones individuales pendientes; los permisos ya aceptados se conservan. Las fusiones o cambios de destino bloquean hasta revisión; no se migra la asociación automáticamente.

## Aceptación y cuenta

`#/invitacion-equipo?token=…` explica la función, vigencia y posible espera del primer administrador. Para consultar/aceptar se requiere login con el correo destinatario. La creación de cuenta usa `/registro` y el registro habitual; no se fabrica una cuenta durante la aprobación ni se marca emailVerifiedAt desde este flujo. El portador de otro correo no recibe los datos de la invitación.

Todos los endpoints de persona pasan por auth: cuenta activa, sessionVersion, política de verificación, invitationPending, MFA inscrito y MFA obligatorio administrativo se conservan. Si el registro requiere verificación, se completa por su flujo normal y se vuelve al enlace original. La invitación no omite esos pasos.

En una transacción de aceptación se revalidan ciclo, supresión, persona aprobada, cuenta/correo/sesión, ficha no fusionada, huella revisada, subrol anterior, capacidad y administrador válido. Luego se añade el ID solo si falta y se asigna un subrol explícito, sin sustituir otros miembros. Se registra teamAudit y evento de aceptación, se enlaza User con la propuesta y se actualizan estados. Si el rol de cuenta era user pasa a representative; admin nunca se degrada. Se incrementa sessionVersion para forzar nuevo login después de toda aceptación.

El cambio de equipo avanza la huella revisada del mismo ciclo para permitir que acepten los siguientes integrantes sin fingir una nueva revisión humana. Cambios ajenos de ficha/equipo requieren revisar el contexto. No cambia active, metadata.dataStatus ni verification de Church, ni los encargados seleccionados de visitas.

Después de aceptar, la pantalla pide iniciar sesión de nuevo y dirige a `#/administracion?iglesia=<id>`. Manage carga esa iglesia mediante su endpoint protegido, mostrando únicamente las áreas autorizadas. No publica, restaura ni verifica la ficha al abrirla. Si la respuesta de red se pierde después de confirmar la transacción, la sesión vieja puede devolver 401: iniciar sesión y reabrir el enlace permite reconocer la aceptación ya registrada. Un replay nunca vuelve a conceder permisos retirados posteriormente.

## Alcance y pendientes

Las funciones, historial, decisiones individuales, enlaces y aceptación están implementados en código. Su ejecución y las carreras de concurrencia no fueron verificadas con pruebas por instrucción del usuario. Pendientes: transporte/outbox individual, entrega/webhooks, exclusiones por identidad fusionada, retención de registros y textos legales definitivos del formulario institucional. No activar campañas antes de resolver esas dependencias. La inscripción anterior sigue separada.

## Integración institucional, etapa 6

Plantillas, lotes explícitos, simulación y cola institucional implementados, con OUTREACH_MAIL_ENABLED=false por defecto. La activación del proveedor y las pruebas siguen pendientes. Esta etapa reemplaza las menciones anteriores a transporte institucional no implementado; no altera las políticas del piloto. Contrato vigente: [Correo institucional](church-outreach-mail.md).
