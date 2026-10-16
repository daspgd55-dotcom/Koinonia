# Colaboración entre iglesias para eventos — contrato y guía de pruebas

## Modelo y permisos

El evento mantiene un `churchId` propietario inmutable y un único `communityId` organizador opcional. La colaboración no crea copias del evento ni añade representantes al propietario. Los permisos de edición, publicación, cancelación, portada y conteos de participantes siguen dependiendo exclusivamente de la iglesia propietaria o del rol admin.

- `openCollaboration:boolean` (predeterminado false) es un campo editable del evento. Indica invitación abierta a propuestas por los canales oficiales; no atribuye participación a ninguna iglesia.
- `collaborations` es interno, no editable mediante PATCH de contenido. Cada entrada guarda una iglesia invitada, estado `pending|accepted|rejected|withdrawn`, ID de la invitación vigente y un historial con acción, actor, nombre, rol, fecha, destinatario y lectura compartida. No incluye correos.
- Solo el propietario/admin invita, retira desde el lado organizador o reenvía una invitación. Solo representantes actualmente asignados a la iglesia invitada/admin aceptan, rechazan o retiran la aceptación. Ser representante de otra iglesia no basta.
- Invitar, reenviar y aceptar requieren evento publicado, iglesia propietaria pública, comunidad organizadora pública si existe, inicio futuro y evento no cancelado. La invitada también debe estar pública y activa. Rechazar o retirar sigue permitido si el evento deja de ser público o ya comenzó.
- No se puede invitar al propio propietario. Se admite una entrada por iglesia durante toda la vida del evento: reenviar reutiliza su entrada e historial, sin duplicarla. Límite del piloto: 100 iglesias invitadas distintas por evento, incluidas invitaciones retiradas/rechazadas.

## API

Todas las rutas de gestión requieren Bearer y rol admin/representative. Las escrituras exigen `If-Match: "<version del evento>"`; no se acepta versión en el cuerpo. `Cache-Control: no-store`.

| Método y ruta | Entrada y respuesta |
| --- | --- |
| `GET /api/events/:id/collaborations` | Solo propietario/admin. `{version,canInvite,data:[{churchId,churchName,status,history}]}`; iglesias no públicas se identifican como no disponibles, sin devolver su nombre |
| `POST /api/events/:id/collaborations` | Propietario/admin; `{churchId}`. 201 `{version,status:pending}` |
| `PATCH /api/events/:id/collaborations/:churchId` | `{action}` según permisos y tabla de transiciones. 200 `{version,status}` |
| `GET /api/event-collaborations` | Bandeja paginada de iglesias autorizadas: `direction=received|sent` (received por defecto), `churchId?`, `eventId?`, `page=1`, `limit=20` (máximo 50) |

La bandeja devuelve `{data:[{eventId,version,churchId,churchName,ownerSide,status,history,canAccept,event}],pagination}`. `event` usa el contrato público filtrado y es null si no está disponible; el receptor nunca recibe el contenido de un borrador. Los administradores pueden recorrer ambos sentidos e intervenir en nombre de cualquier iglesia; el historial deja explícito su rol. La bandeja enviada muestra a la invitada; la recibida se refiere a la iglesia del equipo receptor.

| Acción | Actor autorizado | Estado previo | Estado resultante |
| --- | --- | --- | --- |
| invite (POST) | Propietario/admin | No existe | pending |
| accept | Invitada/admin | pending | accepted |
| reject | Invitada/admin | pending | rejected |
| withdraw_owner | Propietario/admin | pending o accepted | withdrawn |
| withdraw_guest | Invitada/admin | accepted | withdrawn |
| reinvite | Propietario/admin | rejected o withdrawn | pending |

Errores: 400 cuerpo inválido o `SELF_INVITATION`; 401 sin sesión; 403 sin rol/asignación; 404 evento/invitación/iglesia inexistente o iglesia invitada no pública; 409 `STALE_VERSION`, `DUPLICATE_INVITATION`, `INVALID_TRANSITION`, `EVENT_CLOSED` o `INVITATION_LIMIT`; 428 falta If-Match.

Estado, historial y versión se escriben juntos en el mismo documento mediante comparación atómica. La creación también compara que la iglesia no exista ya en el arreglo. Dos respuestas concurrentes con la misma versión producen un éxito y un conflicto; no dos estados finales. La versión es compartida con edición, publicación y cancelación: una acción desde otra sesión puede obligar a actualizar un formulario abierto. La lectura de avisos no incrementa esa versión ni reemplaza el historial.

## Visibilidad pública

El DTO público añade `openCollaboration` y `collaborators:[{_id,name}]`. Solo contiene entradas aceptadas cuyas iglesias están activas y publicadas/verificadas. No incluye invitaciones pendientes, rechazos, retiradas, actores ni historial. La verificación de una iglesia no se transfiere al evento.

`GET /api/events?associatedChurchId=<id>` permite buscar eventos propios o eventos con colaboración aceptada y visible. Se aplica antes de contar/paginar y cada evento aparece una sola vez. `churchId` conserva su significado de propietario exacto; `communityId` sigue siendo organizador exacto. Los filtros de fecha/categoría/público y próximos/pasados siguen vigentes.

“Próximos eventos” de una iglesia usa associatedChurchId; indica “Esta iglesia colabora” cuando no es propietaria, y conserva el organizador original. Las comunidades vinculadas muestran únicamente sus propios eventos. Al retirar una colaboración, el evento desaparece de la ficha de la colaboradora y de su lista pública de colaboraciones, pero permanece en la iglesia propietaria. Si una colaboradora oculta su ficha, se oculta su nombre y vínculo sin cancelar ni despublicar el evento. Su aceptación se conserva y vuelve a ser visible si la iglesia vuelve a ser pública.

## Notificaciones

Se reutilizan `/api/notifications`, su paginación, contador y acción de lectura. Nuevos avisos `source:collaboration` incluyen `eventId`, `churchId` destinataria y `direction` para navegar a la bandeja correcta. El ID persistente de la entrada del historial identifica el aviso; consultar repetidamente no crea registros nuevos.

- Invitar/reenviar avisa al equipo de la invitada.
- Aceptar, rechazar o retirar aceptación avisa al equipo propietario.
- Retirar por parte del organizador avisa al equipo invitado.
- Cambios relevantes de fecha/horario/lugar/modalidad y cancelación/vuelta a programado avisan a las colaboradoras aceptadas. Se añaden a su historial en la misma escritura atómica del cambio. Las ediciones menores no generan avisos.
- Marcar leído comparte `readAt` entre todos los representantes actualmente autorizados de la iglesia destinataria. Resolver la invitación hace que su aviso deje de estar pendiente para todo el equipo, aunque otro representante no lo haya abierto. Reenviar crea un aviso nuevo y mantiene resueltas las invitaciones anteriores. Los avisos de decisiones para el otro equipo siguen pendientes hasta que ese equipo los lea.
- Si el evento está oculto, sus notificaciones se ocultan del listado y contador; su historial permanece. Reaparecen con la lectura conservada si vuelve a ser público. Los avisos de invitación de un evento cancelado o iniciado se consideran resueltos, ya que no se puede aceptar. Las decisiones y avisos de cambio conservan su lectura hasta ser atendidos.
- No se envían correos ni notificaciones a usuarios normales por invitaciones institucionales. Los avisos personales de participación y los de primeras visitas conservan sus reglas propias.

## Interfaz

- Administración de evento: casilla de invitación abierta en Participación y contacto; sección de colaboración con búsqueda de iglesias públicas, selección, invitación, estados, historial y retirada/reenvío. Guarda el formulario antes de gestionar invitaciones.
- `/#/colaboraciones`: bandejas Recibidas/Enviadas. Accesible desde Eventos de administración y el menú del perfil de representantes/admin. No aparece a usuarios normales; el backend impide el acceso igualmente.
- Parámetros `direction`, `churchId` y `eventId` permiten abrir el contexto de un aviso. Se puede volver al listado completo. La bandeja actualiza cada 15 segundos y al recuperar foco, además del botón Actualizar.
- Confirmación para rechazo y retiradas; conflictos explicados y recarga de estado. Diseño móvil, controles de teclado, estados vacíos/carga/error e historial desplegable.

## Guía de pruebas aisladas

Backend: `node --test test/event-collaboration.test.js` y `node --test --test-concurrency=1 test/*.test.js`.

Frontend: `npm run test:event-collaboration`, `npm run test:events-admin`, `npm run test:public-events`, `npm run test:event-participation`, `npm run test:linked`, `npm run test:public-communities`, `npm run test:manage`, `npm run test:experiences`, `npm run test:visits`, `npm run build`.

Las pruebas crean MongoDB temporal, iglesias y usuarios ficticios. No cargan .env, no usan Atlas ni modifican datos de producción; multimedia usa proveedor simulado.

Recorrido manual en base desechable:
1. Crear iglesia A con representante A y B con representantes B1/B2, más admin y usuario normal. Publicar ambas y un evento futuro de A.
2. Declarar invitación abierta: verificar texto público y ausencia de colaboradoras confirmadas.
3. Invitar B; comprobar aviso de B1/B2, ausencia pública de B, imposibilidad de invitar A o duplicar B y denegación de edición del evento a B.
4. Aceptar como B1: B2 ve aceptada y sin aviso pendiente. B aparece públicamente y el evento se muestra en su iglesia, manteniendo A como organizadora.
5. Intentar aceptar/rechazar simultáneamente con una versión: una acción gana, la otra recibe 409. Probar revocación de asignación.
6. Retirar como B, reenviar como A, rechazar como B; reenviar e intervenir como admin; comprobar nombres/roles en historial. Retirar también desde A.
7. Cambiar fecha/lugar y cancelar como A: B aceptada recibe un aviso por cambio, sin correos ni datos de participantes. Abrir aviso comparte lectura y navega correctamente.
8. Ocultar B: no aparece públicamente pero A conserva el evento. Ocultar A: no se expone el evento por enlace directo ni en bandeja de B. Retirar sigue permitido. Verificar eventos pasados/cancelados no aceptables y límite de invitaciones.

## RF-05: estado al cerrar esta versión

Terminados: administración de comunidades vinculadas; eventos únicos con propietario y organizador; publicación/cancelación/archivo; descubrimiento público, filtros y fichas compartibles; intenciones individuales y listado personal; conteos privados; notificaciones internas; colaboración institucional con aceptación, trazabilidad, retirada, visibilidad y lectura compartida.

Limitaciones comprobadas: 100 iglesias invitadas distintas por evento; invitación/aceptación solo antes del inicio y con evento/iglesias públicos; actualización periódica (no tiempo real por sockets); versión global que exige recargar ante cambios simultáneos. La invitación abierta es informativa y se canaliza por contactos oficiales, no por un chat o formulario de postulación.

Mejoras futuras: equipos/roles de ministerio, solicitudes institucionales iniciadas por una iglesia interesada, correos, asistencia efectiva, cupos/entradas/pagos y escalado del historial a gran volumen. No hay permisos compartidos de edición ni inscripción oficial dentro de Koinonía. Render queda para verificación del propietario tras el push.


### Resultado de la revisión local

Suite completa del backend: 93 pruebas aprobadas. Cinco pruebas específicas de colaboración incluyen carreras entre aceptación/rechazo y aceptación/retirada, lectura compartida, intervención de admin, privacidad y límite de 100 invitaciones (incluida la escritura atómica de avisos a 100 colaboradoras). Nueve recorridos de navegador aprobados: colaboración, administración de eventos, eventos públicos, participación, administración de comunidades vinculadas, comunidades públicas, administración de iglesias, experiencias y primeras visitas. Compilación de producción del frontend aprobada. Estas comprobaciones utilizan datos aislados; no equivalen a verificar el despliegue de Render.
