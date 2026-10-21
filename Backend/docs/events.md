# Eventos — contrato de backend

Entidad independiente `Event`, colección `events`. No se modifica la estructura de iglesias, comunidades vinculadas, reuniones ni primeras visitas; no hay importación automática desde horarios semanales. Incluye administración web y subida de portadas. Incluye descubrimiento y fichas públicas de eventos. Incluye intenciones personales de participación y notificaciones internas. Incluye colaboración institucional por invitación aceptada. No incluye inscripciones internas ni asistencia efectiva.

## Organización y permisos

- `churchId` obligatorio e inmutable. Admin administra todas las iglesias; un representante necesita asignación actual en `church.representatives` de la iglesia propietaria. Un usuario común no tiene acceso a los endpoints administrativos.
- `communityId` opcional (`null`): organiza directamente la iglesia. Si se proporciona, debe identificar una comunidad vinculada de esa misma iglesia. Editar un evento no puede trasladarlo a otra iglesia.
- Crear siempre produce `publicationStatus=draft` y `eventStatus=scheduled`. Se permiten borradores incompletos incluso antes de publicar la iglesia; no concede permisos a responsables informativos.
- Publicar exige iglesia activa, publicada o verificada, con `firstPublishedByAdminAt`. Si hay comunidad organizadora, también debe estar publicada. Admin cumple estos requisitos igual que el representante.
- Al publicar se requieren descripción, inicio y los datos correspondientes a la modalidad y participación. `title` es obligatorio incluso para borradores.
- La actualización de contenido de un evento ya publicado revalida los requisitos de publicación; no cambia automáticamente el estado. Si su iglesia/organizador se ha ocultado, puede pasarse a borrador para continuar su preparación. Cancelar o archivar sigue permitido a sus gestores aun cuando el padre esté oculto.
- Cada lectura pública exige evento publicado, iglesia pública (activa y publicada/verificada) y comunidad organizadora publicada y perteneciente a esa iglesia, si existe. Se aplica antes de contar y paginar. Esto oculta referencias rotas, iglesias eliminadas/inactivas y comunidades archivadas, sin modificar el evento almacenado.
- Un evento cancelado sigue disponible públicamente mientras cumpla esos requisitos. Archivar retira su presentación pública sin eliminarlo. Todas las transiciones de publicación son posibles, revalidando siempre al publicar.

## Datos editables

| Campo | Tipo y reglas |
| --- | --- |
| `churchId` | ID de iglesia, solo al crear |
| `communityId` | ID de comunidad vinculada o `null` |
| `title` | 1–200 caracteres, sin espacios exteriores |
| `description` | Hasta 10000 caracteres; obligatoria para publicar |
| `category` | `gathering` encuentro, `community_service` servicio comunitario, `evangelism` evangelización, `retreat` retiro, `workshop` taller, `cultural` actividad cultural, `other` otro (predeterminado) |
| `startsAt` | Fecha/hora, o `null` en borradores |
| `endsAt` | Fecha/hora opcional, posterior al inicio; `null` elimina el término explícito |
| `modality` | `in_person` presencial (predeterminado), `online` en línea, `hybrid` mixta |
| `venue` | Nombre opcional del lugar, 1–200 caracteres, o `null` |
| `location` | Ubicación propia del evento o `null`; comuna obligatoria cuando se informa el objeto; dirección, ciudad, región, countryCode `CL` y coordenadas opcionales. Publicar presencial/mixto exige dirección y comuna |
| `location.coordinates` | GeoJSON `{type:"Point",coordinates:[longitud,latitud]}`, rangos −180…180 y −90…90 |
| `onlineUrl` | Enlace HTTP/HTTPS o `null`, obligatorio para publicar en línea/mixto |
| `audience` | Hasta 50 textos de 1–200 caracteres |
| `cover` | Recurso opcional `{url,source,title?,frame?,focalX?,focalY?}` o `null`. URL HTTP/HTTPS, fuente obligatoria, marcos existentes y foco 0–100. Es una imagen; no contiene `type` ni `category` |
| `participation` | `free` entrada libre (predeterminado), `registration` inscripción requerida, `invitation` invitación |
| `participationConditions` | Hasta 10000 caracteres; obligatoria para publicar por invitación |
| `registrationInstructions` | Hasta 10000 caracteres |
| `registrationUrl` | Enlace HTTP/HTTPS opcional o `null`; inscripción requerida exige este enlace o instrucciones al publicar |
| `contact` | website, instagram, facebook, youtube (HTTP/HTTPS), email y phone (máximo 40 caracteres) |
| `privateFields` | `{email:boolean,phone:boolean}`. `true` oculta el contacto público; ambos por defecto `false` |

La ubicación se guarda como información propia, no como referencia dinámica: cambiar la dirección de la iglesia no modifica el evento. La administración permite copiar explícitamente la dirección de la iglesia como datos propios del evento. Los contactos tampoco se heredan de la iglesia ni de la comunidad: son canales oficiales propios del evento.

No se acepta `location` presencial para modalidad `online`, ni `onlineUrl` para modalidad `in_person`. Al cambiar de modalidad, envía `null` para limpiar el dato incompatible en el mismo PATCH. Una modalidad mixta admite ambos. Un borrador puede carecer de ubicación y enlaces, pero los datos que se proporcionen deben ser válidos.

## Fechas, horario del piloto y finalización

- Fechas almacenadas como `Date` BSON/instantes UTC y devueltas en ISO UTC (`Z`).
- Entrada sin sufijo, por ejemplo `2026-10-15T19:00`, significa **UTC−3 fijo**, equivalente a `2026-10-15T22:00:00.000Z`.
- Se aceptan `Z` y offsets explícitos, por ejemplo `2026-10-15T19:00:00-03:00`; se normalizan al mismo instante UTC. Se admiten segundos y hasta tres decimales de milisegundos.
- No se utiliza la zona estacional `America/Santiago`, ni la zona del servidor. Enero y julio utilizan el mismo desplazamiento en entradas locales sin sufijo. Las interfaces muestran fechas usando UTC−3 fijo sin exponer una etiqueta técnica al usuario.
- Se rechazan fechas imposibles (30 de febrero), horas inválidas, fechas sin hora y término anterior o igual al inicio. Si hay término, debe existir inicio.
- `effectiveEndsAt` es calculado por el servidor: término explícito, o la medianoche inmediatamente posterior al día local del inicio. Por ejemplo, inicio `2026-12-31T23:30-03:00` sin término implica cierre `2027-01-01T00:00-03:00`, equivalente a `2027-01-01T03:00Z`.
- `displayStatus` devuelve `cancelled` si está cancelado; de lo contrario `finished` cuando el reloj alcanza `effectiveEndsAt`, o `scheduled`. No se escribe “finished” en la base, no requiere cron y no altera versiones. El término explícito puede extender un evento a días siguientes.
- Los borradores sin inicio no tienen `effectiveEndsAt`; se encuentran con `view=all`. No se infiere asistencia ni se impide conservar eventos históricos.

## Rutas

Base `/api`. Todos los endpoints de gestión requieren `Authorization: Bearer <token>` y rol autorizado.

| Método y ruta | Uso |
| --- | --- |
| `POST /events` | Crear borrador, 201 |
| `GET /events/manage` | Listado de eventos administrables, 200 |
| `GET /events/manage/:id` | Ficha administrativa, versión y ETag, 200 |
| `PATCH /events/:id` | Editar contenido, 200 |
| `PATCH /events/:id/publication` | Cambiar publicación, 200 |
| `PATCH /events/:id/status` | Cancelar o volver a programado, 200 |
| `GET /events` | Listado público, sin sesión |
| `GET /events/:id` | Ficha pública, sin sesión; 404 si no está disponible |

Fichas y mutaciones devuelven `{data:{...}}`. Gestión incluye `version`, auditoría y banderas de privacidad. La ficha pública usa una lista explícita de campos: contenido del evento, fechas y término efectivo, estado del evento, motivo de cancelación, `displayStatus`, contacto filtrado, `church:{_id,name}` y `organizer:{type:"church"|"community",_id,name}`. Excluye versiones, autores, cuentas de representantes, banderas de privacidad, metadatos internos e insignias heredadas. Todas las respuestas llevan `Cache-Control: no-store`.

### Filtros y paginación

`q`, `churchId`, `communityId`, `category`, `commune`, `audience`, `dateFrom`, `dateTo`, `view`, `page` y `limit`.

- `q` busca una parte literal del título sin distinguir mayúsculas, tanto en consulta pública como administrativa. Acepta 1–200 caracteres después de quitar espacios exteriores; omite el parámetro cuando no hay búsqueda. Los caracteres de expresiones regulares se interpretan como texto. Se combina con los demás filtros antes de paginar y solo cuenta eventos visibles/autorizados. Ejemplo: `GET /api/events?q=encuentro&category=gathering&limit=12&page=1`.
- `commune` y `audience` buscan coincidencia exacta sin distinguir mayúsculas, escapando expresiones regulares. Comuna corresponde al lugar del evento, no a la iglesia.
- Fechas `YYYY-MM-DD`: filtran **el inicio** desde la medianoche local inclusiva de `dateFrom` hasta la medianoche siguiente a `dateTo`, exclusiva. No son un filtro de solapamiento de duración. Se rechaza rango invertido. Cada límite es opcional.
- `view=upcoming` (predeterminado público): término efectivo futuro, incluye eventos que ya comenzaron pero no han terminado. Incluye cancelados futuros para mostrar su aviso.
- `view=past`: término efectivo alcanzado en las últimas 72 horas; `view=all`: próximos y finalizados en las últimas 72 horas. Estas ventanas solo afectan consultas públicas; gestión conserva el historial. Gestión usa `all` por defecto y admite además `publicationStatus` y `eventStatus`.
- En consultas públicas `all`: próximos por inicio ascendente, luego finalizados por término descendente. En otras vistas, orden por inicio ascendente; en `past`, descendente. Desempate por `_id` ascendente. En gestión `all`, los borradores sin fecha se ordenan primero.
- `page` entero 1–10000 (por defecto 1); `limit` entero 1–100 (por defecto 20).
- Respuesta `{data:[...],pagination:{page,limit,total,pages}}`; solo cuenta registros visibles/autorizados. Un filtro administrativo explícito de iglesia ajena responde 403.

### Crear y completar un borrador

```http
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json
```
```json
{
  "churchId":"<id de iglesia asignada>",
  "communityId":null,
  "title":"Jornada de servicio",
  "description":"Encuentro abierto para colaborar con el barrio.",
  "category":"community_service",
  "startsAt":"2026-11-21T10:00",
  "endsAt":"2026-11-21T13:00",
  "modality":"in_person",
  "venue":"Sede comunitaria",
  "location":{"address":"Dirección de ejemplo","commune":"Santiago"},
  "audience":["Público general"],
  "participation":"free"
}
```

Solo título e iglesia son indispensables para crear; el resto puede completarse después. El evento no queda publicado al crear.

### Edición y protección de versiones

Cada PATCH exige `If-Match: "N"`, donde N es la versión de la última consulta administrativa. Todas las mutaciones comparten una versión, comparada e incrementada atómicamente. La creación comienza en 1. Dos cambios simultáneos con la misma versión producen un éxito y un conflicto 409; una cancelación también invalida formularios de edición abiertos.

Campos omitidos se conservan. Objetos y arreglos enviados reemplazan su grupo completo; `contact:{}` o `audience:[]` los vacían. Usa `null` en los campos anulables. Las fechas de un PATCH se validan junto a las fechas ya guardadas. `privateFields` incluido reemplaza ambas banderas, con las omitidas en ese objeto por defecto `false`: conserva las dos al editar privacidad. Se rechazan campos desconocidos, cuerpos vacíos, `churchId` en edición y escrituras de estados, auditoría, versiones, término efectivo o `displayStatus` mediante PATCH de contenido.

Publicación:

```http
PATCH /api/events/<id>/publication
If-Match: "1"
```
```json
{"publicationStatus":"published"}
```

Los otros valores son `draft` y `archived`. Cancelación es una acción separada:

```http
PATCH /api/events/<id>/status
If-Match: "2"
```
```json
{"eventStatus":"cancelled","cancellationReason":"Suspendido por condiciones meteorológicas."}
```

Motivo público obligatorio de 5–1000 caracteres. Para volver a programado, envía `{"eventStatus":"scheduled"}` con la versión actual; se limpia el motivo. Esta acción no cambia fechas ni publicación. Reprogramar fechas requiere PATCH de contenido. No hay eliminación física. La cancelación y la vuelta a programado generan avisos internos para participantes, según el contrato de participación.

Errores en formato existente `{error:{code,message,details?}}`: 400 validación o `INVALID_ORGANIZER` / `INCOMPLETE_EVENT`; 401 sin sesión; 403 sin asignación o rol; 404 registro inexistente o no disponible públicamente; 409 `STALE_VERSION`, `CHURCH_NOT_PUBLISHABLE` u `ORGANIZER_NOT_PUBLISHED`; 428 `VERSION_REQUIRED`. Para `INCOMPLETE_EVENT`, `details` enumera campos pendientes.

## Pruebas aisladas

Desde `Backend`:

```powershell
node --test test/events.test.js
node --test --test-concurrency=1 test/*.test.js
```

`events.test.js` utiliza MongoDB temporal y usuarios ficticios, sin cargar `.env` ni usar Atlas. Cubre calendario real, verano/invierno fijo, cambio de año, cierre sin término, roles y asignaciones, iglesia/comunidad ajenas, publicación inicial, validación de modalidad y participación, conservación de campos, conflictos simultáneos entre operaciones, cancelación visible, privacidad, ocultación dinámica y filtros con límites locales.

Para probar manualmente, utiliza una base desechable: crea dos iglesias con representantes distintos; crea un evento con el representante A; comprueba que B no puede consultarlo en gestión; publica primero iglesia y comunidad organizadora si corresponde; completa y publica el evento; consulta sin sesión; cancélalo y verifica el aviso público; archívalo y comprueba 404. Ninguna prueba necesita enviar correos ni crear avisos de primera visita.


## Administración web

En `/#/administracion`, abre una iglesia y selecciona “Eventos”, junto a “Ficha de la iglesia” y “Comunidades vinculadas”. La sección permite listar, buscar, filtrar, crear, editar, previsualizar, publicar, cancelar y archivar. Gestión y consulta pública aceptan `q` (hasta 200 caracteres): búsqueda literal parcial por título, sin distinguir mayúsculas; se aplica en servidor antes de paginar.

El formulario organiza información principal, fecha/lugar, participación/contacto e imagen. El organizador puede ser la iglesia o una comunidad asignada; una comunidad en borrador sirve para preparar el evento, pero impide publicarlo. Las archivadas no se ofrecen para nuevas selecciones; una selección antigua se conserva identificada y bloquea publicación.

Los controles de fecha/hora muestran minutos, sin etiqueta técnica. La conversión es fija UTC−3, independiente de la zona del navegador. Al editar otros campos se conserva el instante original, incluso si tenía segundos. “Usar dirección de la iglesia” copia explícitamente dirección, comuna, ciudad, región, país y coordenadas como datos del evento; al editar manualmente la dirección se retiran las coordenadas anteriores para no dejar un punto incoherente. No copia atributos privados ni mantiene una relación dinámica.

La vista previa excluye contactos marcados privados y muestra el motivo si ya está cancelado. No es una publicación. Los controles distinguen Publicación y Situación. La lista de pendientes impide publicar hasta completar los requisitos y guardar los cambios. El backend vuelve a validar cada operación. Cancelación requiere motivo público de al menos cinco caracteres y confirmación; archivar solicita confirmación y retira el evento del público. Los errores conservan las respuestas; ante conflicto se bloquea guardar y se ofrece recargar con confirmación. Salir con cambios pendientes solicita confirmación; no se promete recuperación tras aceptar descartarlos.

### Portadas

`POST /api/events/:id/cover?frame=wide`: rol autorizado, iglesia asignada y `If-Match: "N"`; cuerpo binario JPEG/PNG/WebP hasta 5 MB y su Content-Type. Admite los marcos existentes. Valida firma del archivo, límite de solicitudes, versión y autorización. Usa Cloudinary configurado en el servidor y carpeta propia `koinonia/events/<eventId>/<uuid>`. Responde 201 `{data}` con nueva versión y portada. No modifica publicación ni cancelación. Se puede subir estando en borrador; no requiere publicar. Si falla la escritura o se revoca la asignación durante la subida, intenta retirar el archivo recién subido.

El recortador compartido permite zoom y desplazamiento antes de subir. El formulario permite añadir un enlace, modificar marco y foco, o quitar la portada con el PATCH existente (`cover:null`). Reemplazar/quitar conserva los archivos remotos anteriores; no ejecuta borrado físico. La subida se guarda inmediatamente y conserva otros cambios locales pendientes. Sin proveedor, responde 503; formato inválido, 400; conflicto, 409.

### Prueba de interfaz

Desde `Frontend`: `npm.cmd run test:events-admin`. Arranca API, Vite y MongoDB temporales y simula Cloudinary. Cubre ambos roles, aislamiento de iglesias, preparación incompleta, organizador vinculado, privacidad de vista previa, portada y recorte, publicación, copia independiente de ubicación, edición, conservación ante errores, conflicto, confirmación de salida, cancelación pública, archivo, búsqueda y vista móvil. No usa cuentas ni servicios de producción. Regresión de navegación compartida: `npm.cmd run test:linked`.


## Interfaz pública y alcance de RF-05

- `/#/eventos`: accesible sin sesión y con cualquier rol. Búsqueda parcial por nombre y comuna visibles inicialmente; periodo (próximos/pasados/todos), fecha desde/hasta, categoría y público en “Más filtros”. Próximos primero (incluye los que ya comenzaron y no terminaron). Comuna y público usan coincidencia exacta sin distinguir mayúsculas, conforme al contrato de API. Cada filtro aplicado se puede retirar individualmente y los cambios sin aplicar se señalan.
- Los filtros y la página se guardan en la URL (`q`, `view`, `dateFrom`, `dateTo`, `commune`, `category`, `audience`, `sort`, `page`). También se admite `churchId`, `associatedChurchId` o `communityId` para los enlaces contextuales. Volver desde una ficha recupera esa URL; limpiar filtros conserva el contexto del organizador, mientras que “Ver todos” lo elimina.
- Tarjetas completas pulsables y accesibles por teclado, en dos columnas en escritorio y una en móvil. Sin portada no se reserva un espacio de imagen. Se conservan los marcos horizontal, panorámico, cuadrado, circular y vertical, ajustando el marco completo para evitar deformaciones; una imagen que falla se omite.
- `/#/evento/:id`: ficha compacta y compartible independiente de la sesión. `volver` opcional guarda un regreso interno al listado filtrado, iglesia o comunidad; no es necesario para compartir. La cabecera reúne portada ampliable, fecha local, organizador, iglesia de origen, modalidad y ubicación. Bajo ella se muestran descripción, audiencia e instrucciones oficiales; el contacto público es desplegable. Los estados cancelado y finalizado son explícitos; cancelar no oculta la descripción ni el motivo público.
- Navegación: Eventos en el grupo secundario, desplegado mediante “Menú” en móvil para conservar la barra compacta.
- “Próximos eventos” en iglesia muestra sus eventos y los de sus comunidades; en comunidad solo muestra los organizados por ella. Hasta dos tarjetas, con enlace al listado completo cuando existen más. Sin resultados visibles, se omite toda la sección. Las imágenes son opcionales y respetan marco y posición.
- Las fichas usan respuestas públicas; el listado admite sesión opcional para personalizar el orden, y participación/visualización usan endpoints autenticados. Borradores, archivados y eventos de iglesias/comunidades no públicas devuelven contenido no disponible por enlace directo. Se respetan las banderas de privacidad del contacto. No se hereda una insignia de verificación.

**RF-05 implementado:** comunidades vinculadas con permisos y ciclo de publicación; administración de eventos independientes con organizador, portada, ubicación propia, fechas, participación, cancelación y archivo; descubrimiento público filtrado, fichas compartibles e integración con iglesias/comunidades. La inscripción, cuando se exige, se realiza según las instrucciones o el enlace oficial del organizador.

**Pendiente:** inscripciones dentro de Koinonía, asistencia efectiva, correos, cupos, entradas, pagos, equipos de bienvenida para eventos y permisos compartidos de edición. Tampoco hay membresías de grupos; el seguimiento de iglesias sí está implementado. La consulta de una ficha o enlace no registra ni confirma asistencia.

Verificación aislada desde `Frontend`: `npm.cmd run test:public-events`, `npm.cmd run test:public-communities`, `npm.cmd run test:events-admin` y `npm.cmd run test:linked`. Desde `Backend`: `node --test --test-concurrency=1 test/*.test.js`. Se usan MongoDB temporal, usuarios ficticios y proveedores multimedia simulados; no Atlas ni datos de producción.


## Participación personal y notificaciones internas

Colección independiente `eventparticipations`, sin registros en `visits`. Índice único compuesto `(event,user)`; un único estado `interested`, `going` o `withdrawn`. PUT atómico y repetible: ante peticiones simultáneas permanece una sola fila y prevalece la última escritura. Cambiar entre interés e intención conserva el inicio de la suscripción; retirar conserva la fila, excluye conteos y avisos. Reactivar inicia una nueva suscripción y no recupera avisos anteriores. No se recogen datos personales adicionales.

| Método y ruta | Contrato |
| --- | --- |
| `GET /api/events/:id/participation` | Sesión; `{data:{status:null|interested|going,canParticipate:boolean}}`; 404 si evento no público |
| `PUT /api/events/:id/participation` | Sesión; cuerpo estricto `{status:interested|going|withdrawn}`; usuario tomado del token, no del cliente |
| `GET /api/events/mine?view=upcoming|history&page=1&limit=20` | Solo registros del usuario; paginación máximo 50. `{data:[{eventId,status,pending,event}],pagination}` |
| `GET /api/events/:id/participation-counts` | Admin o representante actualmente asignado; `{data:{interested,going}}`, sin identidades ni correos |

Crear/cambiar opción exige evento visible, no cancelado e inicio estrictamente futuro; se valida también después de escribir. 401 sin sesión, 400 estado/cuerpo inválido, 409 no disponible para participar. Retirar se permite incluso si ya comenzó o dejó de ser público. El público nunca recibe listas ni conteos de asistentes. Los conteos administrativos expresan intención, no inscripciones ni asistencia real.

`upcoming` solo incluye eventos públicos no cancelados cuyo inicio es futuro. `history` contiene iniciados/finalizados, cancelados y ocultos. En ocultos, `event:null` y la interfaz solo dice “Evento no disponible”, sin título, lugar ni contactos. Un evento iniciado no se presenta como asistencia pendiente, aunque todavía no termine. No se infiere que el usuario haya asistido.

Cada modificación relevante de un evento publicado añade atómicamente una entrada a `Event.participationChanges` junto al incremento de versión: cambio real de inicio/término, lugar/dirección/coordenadas, modalidad/enlace de acceso, cancelación o vuelta a programado. Se agrupan varios cambios en un solo aviso por versión. Texto descriptivo, título, imagen, contactos e instrucciones no generan avisos. Un conflicto de versión no añade una entrada. Este historial interno no se expone en fichas públicas ni respuestas de administración.

Los avisos se calculan en `/api/notifications` uniendo ese historial con participaciones activas iniciadas antes del cambio y con la visibilidad pública actual. No hay envío en segundo plano ni riesgo de perder un aviso entre guardar el evento y distribuir mensajes. El ID persistente del cambio identifica el aviso; consultar repetidamente no lo duplica. Cada participación guarda los IDs leídos con `$addToSet`; la lectura de una persona no afecta a otras. El endpoint existente `PATCH /api/notifications/:id/read` verifica propiedad y visibilidad. La paginación y el total no leído combinan avisos de eventos y primeras visitas en orden temporal. La lectura compartida del equipo para primeras visitas permanece intacta.

Al archivar, despublicar el evento, ocultar la iglesia o la comunidad organizadora, sus avisos desaparecen del listado y contador, sin borrar historial ni participaciones. Si vuelve a ser público, los avisos conservados vuelven con su estado de lectura; no se crean avisos por archivar/republicar. Retirar participación oculta sus avisos; reactivarla solo habilita los posteriores. Los avisos leídos permanecen consultables y los eventos pasados se conservan en historial.

Interfaz: botones “Me interesa” y “Voy a asistir” en ficha pública; inicio de sesión con regreso al evento; enlace “Mis eventos” en menú de perfil y ficha, ruta `/#/mis-eventos`; conteos en administración del evento. La intención de asistir no sustituye inscripción externa ni invitación. Abrir un aviso marca leído, actualiza la campana y navega a `/#/evento/:id`. No hay listas públicas de personas.

Pruebas nuevas: `Backend/test/event-participation.test.js` (concurrencia, aislamiento, privacidad, cambios, deduplicación, lecturas, archivo e historial) y `Frontend/test/event-participation.cjs` (`npm run test:event-participation`: sesión con regreso, opciones, retiro, vista personal, lectura desde campana e historial móvil). Regresión: suite completa backend y `npm run test:visits`, además de comunidades y eventos.


## Colaboración institucional (RF-05)

Implementada: invitación abierta informativa, invitaciones a iglesias publicadas, aceptación/rechazo por representantes asignados, intervención auditada de admin, retiradas y reenvío; notificaciones compartidas y presencia en la iglesia colaboradora. Se conserva un evento y propietario únicos, sin transferir permisos. `openCollaboration` es editable; `collaborations` es interno y solo el DTO `collaborators` con iglesias aceptadas/públicas se expone públicamente. `associatedChurchId` busca eventos propios y colaboraciones visibles.

Contrato completo, transiciones, limitaciones, pruebas y estado actualizado de RF-05: [event-collaboration.md](event-collaboration.md). La colaboración institucional ya no está pendiente; siguen fuera de alcance roles de ministerio, correos, entradas, pagos y edición compartida.
# Visibilidad reciente en el directorio

La página Eventos solicita `view=all` por defecto: muestra primero próximos eventos y después los finalizados recientemente, con etiqueta «Evento Finalizado». Las consultas públicas `view=all` y `view=past` excluyen eventos cuyo `effectiveEndsAt` es anterior a las últimas 72 horas; se filtra antes de paginar y contar. `upcoming` conserva únicamente eventos que no han terminado. En ausencia de término explícito sigue aplicándose el cierre del día local fijo UTC−3.

Esta ventana no borra eventos ni cambia su publicación. Administración conserva el historial y los enlaces directos siguen sujetos a los permisos y visibilidad habituales. Las secciones «Próximos eventos» de iglesias y comunidades continúan mostrando solo próximos. La prueba `events.test.js` cubre 24, 71 y 73 horas, orden, conteo y conservación del historial.

## Recomendación y acciones de interés

El directorio usa recomendaciones por pertenencia, seguimiento y popularidad; los botones de participación se muestran en la cabecera. Para inscripción requerida, `going` devuelve 409 `REGISTRATION_REQUIRED`; interés y retirada siguen disponibles. Contrato, privacidad de visualizaciones y pruebas: [event-recommendations.md](event-recommendations.md).
