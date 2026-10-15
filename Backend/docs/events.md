# Eventos — contrato de backend

Entidad independiente `Event`, colección `events`. No se modifica la estructura de iglesias, comunidades vinculadas, reuniones ni primeras visitas; no hay importación automática desde horarios semanales. Esta etapa no incluye interfaces, inscripciones internas, asistencia, notificaciones, colaboración entre iglesias ni subida binaria de portadas.

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

La ubicación se guarda como información propia, no como referencia dinámica: cambiar la dirección de la iglesia no modifica el evento. Una futura interfaz puede ofrecer copiar la dirección pública, enviando explícitamente esa ubicación. Los contactos tampoco se heredan de la iglesia ni de la comunidad: son canales oficiales propios del evento.

No se acepta `location` presencial para modalidad `online`, ni `onlineUrl` para modalidad `in_person`. Al cambiar de modalidad, envía `null` para limpiar el dato incompatible en el mismo PATCH. Una modalidad mixta admite ambos. Un borrador puede carecer de ubicación y enlaces, pero los datos que se proporcionen deben ser válidos.

## Fechas, horario del piloto y finalización

- Fechas almacenadas como `Date` BSON/instantes UTC y devueltas en ISO UTC (`Z`).
- Entrada sin sufijo, por ejemplo `2026-10-15T19:00`, significa **UTC−3 fijo**, equivalente a `2026-10-15T22:00:00.000Z`.
- Se aceptan `Z` y offsets explícitos, por ejemplo `2026-10-15T19:00:00-03:00`; se normalizan al mismo instante UTC. Se admiten segundos y hasta tres decimales de milisegundos.
- No se utiliza la zona estacional `America/Santiago`, ni la zona del servidor. Enero y julio utilizan el mismo desplazamiento en entradas locales sin sufijo. La futura interfaz debe mostrar UTC−3 fijo sin exponer una etiqueta técnica al usuario.
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

`churchId`, `communityId`, `category`, `commune`, `audience`, `dateFrom`, `dateTo`, `view`, `page` y `limit`.

- `commune` y `audience` buscan coincidencia exacta sin distinguir mayúsculas, escapando expresiones regulares. Comuna corresponde al lugar del evento, no a la iglesia.
- Fechas `YYYY-MM-DD`: filtran **el inicio** desde la medianoche local inclusiva de `dateFrom` hasta la medianoche siguiente a `dateTo`, exclusiva. No son un filtro de solapamiento de duración. Se rechaza rango invertido. Cada límite es opcional.
- `view=upcoming` (predeterminado público): término efectivo futuro, incluye eventos que ya comenzaron pero no han terminado. Incluye cancelados futuros para mostrar su aviso.
- `view=past`: término efectivo alcanzado; `view=all`: sin filtro temporal. Gestión usa `all` por defecto y admite además `publicationStatus` y `eventStatus`.
- Orden por inicio ascendente; en `past`, descendente. Desempate por `_id` ascendente. En gestión `all`, los borradores sin fecha se ordenan primero.
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

Motivo público obligatorio de 5–1000 caracteres. Para volver a programado, envía `{"eventStatus":"scheduled"}` con la versión actual; se limpia el motivo. Esta acción no cambia fechas ni publicación. Reprogramar fechas requiere PATCH de contenido. No hay eliminación física ni avisos automáticos.

Errores en formato existente `{error:{code,message,details?}}`: 400 validación o `INVALID_ORGANIZER` / `INCOMPLETE_EVENT`; 401 sin sesión; 403 sin asignación o rol; 404 registro inexistente o no disponible públicamente; 409 `STALE_VERSION`, `CHURCH_NOT_PUBLISHABLE` u `ORGANIZER_NOT_PUBLISHED`; 428 `VERSION_REQUIRED`. Para `INCOMPLETE_EVENT`, `details` enumera campos pendientes.

## Pruebas aisladas

Desde `Backend`:

```powershell
node --test test/events.test.js
node --test --test-concurrency=1 test/*.test.js
```

`events.test.js` utiliza MongoDB temporal y usuarios ficticios, sin cargar `.env` ni usar Atlas. Cubre calendario real, verano/invierno fijo, cambio de año, cierre sin término, roles y asignaciones, iglesia/comunidad ajenas, publicación inicial, validación de modalidad y participación, conservación de campos, conflictos simultáneos entre operaciones, cancelación visible, privacidad, ocultación dinámica y filtros con límites locales.

Para probar manualmente, utiliza una base desechable: crea dos iglesias con representantes distintos; crea un evento con el representante A; comprueba que B no puede consultarlo en gestión; publica primero iglesia y comunidad organizadora si corresponde; completa y publica el evento; consulta sin sesión; cancélalo y verifica el aviso público; archívalo y comprueba 404. Ninguna prueba necesita enviar correos ni crear avisos de primera visita.
