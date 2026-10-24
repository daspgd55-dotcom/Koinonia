# Comunidades vinculadas: contrato de backend

Las comunidades pueden actuar como organizadoras en el [backend de eventos](events.md). Sus eventos son entidades independientes y no se generan automáticamente desde reuniones habituales.

Implementado: entidad `LinkedCommunity` en la colección `linkedcommunities`, sin modificar documentos de iglesias ni convertir etiquetas existentes. Incluye administración React dentro de cada iglesia. No incluye eventos, membresías de grupos ni permisos nuevos para responsables informativos.

## Datos

- `churchId`: ObjectId obligatorio de una iglesia existente, inmutable.
- `name`: obligatorio, 1–200 caracteres después de quitar espacios exteriores.
- `type`: `youth` (jóvenes), `ministry` (ministerio), `volunteering` (voluntariado), `organization` (organización), `movement` (movimiento), `other` (otro).
- `description`: hasta 10000 caracteres; puede vaciarse con `""`.
- `audience`: hasta 50 textos de 1–200 caracteres.
- `leaders`: hasta 50 objetos `{name, role}`. No contiene cuentas ni otorga permisos.
- `contact`: website, instagram, facebook, youtube (URLs HTTP/HTTPS), email y phone (hasta 40 caracteres). Canales propios de la comunidad; no se copia el contacto de la iglesia.
- `privateFields`: `{email: boolean, phone: boolean}`; `true` oculta ese contacto públicamente. Por defecto ambos son `false`.
- `location`: unión explícita descrita abajo; por defecto `{mode:"none"}`.
- `media`: máximo 7 recursos `{type:"image"|"video",url,source,title?,frame?,focalX?,focalY?}`. URL HTTP/HTTPS, fuente obligatoria, foco entre 0 y 100 y marcos existentes `landscape|wide|square|circle|portrait`. El orden del arreglo determina la presentación. Admite subida de imágenes a Cloudinary; eliminar desde el editor retira la referencia al guardar y conserva el archivo remoto. No añade asignación de retratos a líderes.
- `status`: `draft|published|archived`; siempre se crea en `draft`.
- `version`: inicia en 1 y aumenta por cada actualización o cambio de estado aceptado.
- Auditoría interna: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `__v`.

Ubicación:

```json
{"mode":"none"}
```
```json
{"mode":"church"}
```
```json
{"mode":"custom","custom":{"commune":"Providencia","address":"Dirección del grupo","coordinates":{"type":"Point","coordinates":[-70.61,-33.43]}}}
```

En `custom`, comuna es obligatoria; dirección, coordenadas, ciudad, región, código postal chileno de 7 dígitos y countryCode `CL` son opcionales. Coordenadas en orden longitud/latitud y rangos válidos. `none` y `church` rechazan `custom`: cambiar de modo elimina la ubicación propia anterior. No se guarda ni consulta la ubicación personal de usuarios.

En una respuesta pública, `church` se resuelve dinámicamente como `{mode:"church",resolved:{...ubicación pública actual...}}`, usando el mismo filtro de privacidad que la ficha de iglesia. No se copian accesibilidad ni indicaciones ocultas. Si la dirección de la iglesia cambia, se refleja en la siguiente consulta. La administración recibe el modo almacenado, sin `resolved`.

## Permisos y publicación

- Requiere sesión activa y rol actual `admin` o `representative` en todos los endpoints privados.
- Admin gestiona todas las comunidades; un representante necesita asignación vigente en `church.representatives` de la iglesia padre. El nombre de un líder no es una asignación.
- Se permite crear, consultar y editar borradores incluso con iglesia no pública. Se conserva acceso administrativo a comunidades de iglesias inactivas para consultar, preparar y archivar; no se permite publicarlas.
- Publicar exige iglesia activa, estado `published` o `verified` y `metadata.firstPublishedByAdminAt` presente. También se exige al admin: debe publicar primero la iglesia mediante su flujo existente.
- Todas las transiciones entre `draft`, `published` y `archived` están permitidas; entrar en `published` siempre revalida la iglesia. Archivar no borra información y se puede volver a borrador.
- Editar contenido no cambia el estado de publicación.
- Cada lectura pública exige comunidad publicada e iglesia actualmente activa y publicada/verificada. Una iglesia en borrador, inactiva o eliminada no expone comunidades en listado ni por URL directa. Se comprueba antes de paginar y contar resultados.
- Ocultar la iglesia no modifica el estado ni la versión de las comunidades. Al volver a ser pública, vuelven a verse las que seguían publicadas.
- No se hereda una insignia propia de verificación.

## Endpoints

Base `/api`. Las consultas públicas no requieren autenticación. Los endpoints privados requieren `Authorization: Bearer <token>`.

| Método y ruta | Función |
| --- | --- |
| `POST /communities` | Crear borrador, respuesta 201 |
| `GET /communities/manage` | Listar comunidades administrables |
| `GET /communities/manage/:id` | Ficha administrativa con versión y ETag |
| `PATCH /communities/:id` | Editar campos de contenido, respuesta 200 |
| `PATCH /communities/:id/status` | Cambiar publicación, respuesta 200 |
| `GET /communities` | Listado público |
| `GET /communities/:id` | Ficha pública, o 404 si no está disponible |

Filtros de listado: `churchId`, `type`, `q` (nombre, búsqueda literal sin distinguir mayúsculas), `page` (1–10000, por defecto 1), `limit` (1–100, por defecto 20). Solo administración admite `status`. Orden estable por nombre e ID. Un filtro administrativo explícito de iglesia ajena responde 403; el listado sin filtro solo devuelve iglesias asignadas.

Listados: `{data:[...],pagination:{page,limit,total,pages}}`. Fichas y mutaciones: `{data:{...}}`.

Las respuestas públicas incluyen únicamente `_id`, `churchId`, `church:{_id,name}`, nombre, tipo, descripción, público, líderes informativos, contacto filtrado, ubicación y multimedia. Excluyen cuentas de representantes, autores internos, banderas privadas, versiones e historial interno. Las respuestas llevan `Cache-Control: no-store` para no mantener contenido ocultado en cachés HTTP.

### Crear

```http
POST /api/communities
Authorization: Bearer <token>
Content-Type: application/json
```
```json
{
  "churchId":"<id de iglesia asignada>",
  "name":"Ministerio de Jóvenes",
  "type":"youth",
  "description":"Encuentros de comunidad y servicio.",
  "audience":["Jóvenes"],
  "leaders":[{"name":"Responsable de ejemplo","role":"Coordinación"}],
  "location":{"mode":"church"}
}
```

### Editar y concurrencia

```http
PATCH /api/communities/<id>
Authorization: Bearer <token>
If-Match: "1"
Content-Type: application/json
```
```json
{"description":"Descripción actualizada"}
```

`If-Match` es obligatorio en ambos PATCH. Usa la versión de la última respuesta administrativa o su ETag. El servidor compara e incrementa la versión en una actualización atómica; dos escrituras con la misma versión no pueden sobrescribirse: una obtiene 409. Ante conflicto, vuelve a consultar y reconcilia los cambios; no reintentes ciegamente.

Los campos omitidos se conservan. Cada objeto o arreglo incluido reemplaza ese grupo completo: `contact:{}` limpia el contacto, `leaders:[]` limpia los responsables y `location:{mode:"none"}` elimina la ubicación. Para editar solo un dato dentro de un grupo, envía el grupo completo vigente. `privateFields` incluido reemplaza ambas banderas, con valores omitidos en ese grupo por defecto `false`; conserva ambas al guardar ajustes de privacidad. No se admiten `null`, cuerpos vacíos, campos desconocidos, cambios de `churchId`, `status` en PATCH de contenido, versiones o autores en el cuerpo.

### Publicar, archivar o devolver a borrador

```http
PATCH /api/communities/<id>/status
Authorization: Bearer <token>
If-Match: "2"
Content-Type: application/json
```
```json
{"status":"published"}
```

Usa `archived` o `draft` para las otras acciones. No existe borrado físico desde esta API.

Errores: 400 datos/ID/filtros/versión inválidos; 401 sesión ausente o inválida; 403 permiso insuficiente; 404 comunidad o iglesia inexistente, o ficha pública no disponible; 409 `STALE_VERSION` o `CHURCH_NOT_PUBLISHABLE`; 428 `VERSION_REQUIRED` si falta If-Match. Se conserva el formato `{error:{code,message,details?}}` existente.

## Cómo verificar sin producción

Desde `Backend`:

```powershell
node --test test/linked-communities.test.js
node --test --test-concurrency=1 test/*.test.js
```

Las pruebas crean usuarios, iglesias y comunidades ficticias mediante `mongodb-memory-server`, usan exclusivamente la URI temporal generada y cierran la base al terminar. No cargan `.env` ni conectan a Atlas. Requieren poder ejecutar el binario local de MongoDB; si no está en caché, la librería necesita descargarlo.

Casos cubiertos: creación en borrador, rol y asignación, acceso administrativo global, iglesia inexistente, publicación sin aprobación previa, validación estricta y recursos, ubicación propia/heredada, contactos ocultos, privacidad heredada, ocultación dinámica por iglesia no pública, archivado/reapertura, filtrado/paginación, versiones obligatorias, escrituras simultáneas, conservación de campos omitidos y revocación de asignación.

Para una prueba manual, utiliza un servidor local conectado a una base desechable: crea dos iglesias con representantes distintos mediante el flujo existente; crea un borrador con el representante A; confirma que B no puede editarlo; publica la iglesia A como admin; publica la comunidad con su versión; consulta sin sesión; pasa la iglesia a borrador y comprueba 404 público, listado sin la comunidad y conservación de sus datos administrativos.

Pendientes deliberados: eventos, membresía/seguimiento de comunidades y permisos de equipos específicos. No hay migración de iglesias ni despliegue automático.


## Administración web y fotos

Desde Administración → Comunidades → Administrar una iglesia, usa “Ficha de la iglesia” o “Comunidades vinculadas”. La nueva sección lista solo las comunidades de esa iglesia, con filtros de nombre, tipo y estado y paginación. El formulario agrupa responsables/contacto, ubicación y multimedia en secciones desplegables. Los errores conservan respuestas; una versión en conflicto requiere recargar explícitamente. Salir con cambios pendientes solicita confirmación, también al navegar con el historial del navegador. Cerrar la pestaña muestra el aviso del navegador; no se promete recuperación después de confirmar la salida.

La vista previa es privada, incluye cambios sin guardar y excluye correo/teléfono marcados privados; la ubicación heredada muestra solo dirección, comuna y ciudad. No publica contenido ni entrega una insignia de verificación. El motivo que impide publicar se muestra junto al control. Debes guardar cambios antes de cambiar el estado.

`POST /api/communities/:id/media?frame=circle` requiere rol autorizado, asignación vigente, `If-Match: "N"` y cuerpo binario JPEG/PNG/WebP de hasta 5 MB con Content-Type correspondiente. Marcos: landscape, wide, square, circle, portrait. Responde 201 `{data}` con versión incrementada, sin cambiar publicación. Máximo 7 recursos totales. Reutiliza configuración Cloudinary y limitador de subidas existentes. Guarda en `koinonia/communities/<id>/<uuid>`; si la escritura pierde una carrera o se revoca la asignación durante la subida, intenta limpiar el archivo recién creado. Sin proveedor responde 503, imagen inválida 400, conflicto 409. Nunca utiliza la carpeta de otra iglesia para subir recursos.

Guarda primero el borrador para habilitar “Subir foto”. El recortador compartido permite zoom y movimiento; el editor compartido permite encuadre, enlaces, eliminación y orden con arrastre o flechas del teclado. La subida se guarda inmediatamente; los otros cambios del formulario se conservan. Quitar un recurso requiere guardar la ficha; no borra archivos remotos. Si ya hay siete recursos guardados, guarda las eliminaciones antes de subir otro.

Prueba de navegador local desde `Frontend`: `npm.cmd run test:linked`. Crea MongoDB, servidor API y Vite temporales con cuentas ficticias de admin y representantes; verifica creación, edición, error de guardado, confirmación de salida, vista previa privada, recorte y subida con proveedor simulado, reordenamiento por teclado, eliminación antes de guardar, publicación, archivado, filtros, bloqueo de publicación con iglesia borrador y presentación móvil. No usa producción. Regresión de ficha de iglesia: `node test/publication.cjs` y `node test/manage.cjs`.


## Presentación pública

- `/#/iglesia/:churchId`: la ficha de iglesia incorpora “Comunidades vinculadas” con tarjetas de nombre, tipo, imagen opcional y descripción breve. Consulta `GET /api/communities?churchId=...&page=...&limit=6`; pagina los resultados y oculta toda la sección cuando no hay comunidades visibles. Durante la consulta muestra un estado de carga y, si falla, un aviso con reintento, sin presentar el fallo como ausencia de comunidades.
- `/#/comunidad/:communityId`: enlace público compartible, accesible sin sesión. Consulta exclusivamente `GET /api/communities/:id`; no usa endpoints administrativos ni datos del formulario. Incluye vínculo “Comunidad de [iglesia]” y regreso a `/#/iglesia/:churchId`.
- Secciones opcionales: descripción, público, responsables informativos, contacto oficial, ubicación habitual y multimedia. Los contactos privados ya son eliminados por la API. No se muestran bloques vacíos ni se hereda una insignia de verificación. Los enlaces externos se limitan a HTTP/HTTPS; correo y teléfono tienen sus canales correspondientes.
- La ubicación propia y la heredada se presentan según el modo retornado por la API. La galería compartida conserva encuadres, marcos y zoom. Las tarjetas respetan también el marco de su imagen.
- Borradores, archivadas, IDs inválidos/inexistentes y comunidades cuya iglesia no es pública muestran “Comunidad no disponible”, sin nombre, fotos o contacto anteriores. Los fallos de conexión muestran error y reintento.
- Se descartan respuestas de solicitudes anteriores al cambiar de ficha y se consulta nuevamente al recuperar el foco o volver a una pestaña visible. No se añade membresía, seguimiento, asistencia ni eventos.

Verificación de navegador desde `Frontend`: `npm.cmd run test:public-communities`. Usa MongoDB y servidores temporales, navegación anónima desde iglesia y por enlace directo, validación de privacidad, marcos y zoom, vista móvil, ausencia de secciones vacías, iglesias ocultas y error con reintento. Capturas locales en `Frontend/.cache/journey/linked-public-desktop.png` y `linked-public-mobile.png` (datos ficticios). No necesita Atlas ni credenciales reales.


## Reuniones y horarios (2026-10-23)

Campo opcional `schedules` en creación y PATCH, conservando If-Match y los permisos actuales:
- `{ "mode": "none" }`: sin horarios (predeterminado para datos existentes).
- `{ "mode": "church" }`: muestra todas las reuniones actuales de la iglesia de origen. Es una referencia dinámica, no una copia ni una selección de otra iglesia.
- `{ "mode": "custom", "meetings": [...] }`: reuniones propias con el mismo contrato de tipo, público, modalidad, dirección/enlace, frecuencia, notas y arreglo schedule (day, startTime, durationMinutes) de la iglesia.

La administración reutiliza el editor de reuniones; oculta el control de avisos de visita para comunidades vinculadas. No se crean avisos independientes, eventos ni permisos a partir de estos horarios. La respuesta pública resuelve los horarios efectivos y excluye controles internos de visitas. La ficha y vista previa ocultan el bloque si no hay reuniones. La publicación/visibilidad sigue dependiendo de la iglesia y del estado de la comunidad.

Pruebas: `node --test Backend/test/linked-communities.test.js` verifica herencia dinámica, horarios propios, validación y privacidad. `node Frontend/test/linked-communities.cjs` comprueba edición, horarios, vista previa, permisos, borradores, publicación y móvil. Las tarjetas de administración presentan título y estado juntos.


### Selección de reuniones y logos
- `schedules: {mode:"church", meetingIds:["UUID"]}` hereda únicamente las reuniones seleccionadas. `[]` no muestra ninguna; omitir meetingIds conserva la herencia completa de registros antiguos. IDs ajenos o eliminados se rechazan al guardar. Si una reunión seleccionada se elimina después, desaparece públicamente sin sustituirse por otra.
- Las reuniones de iglesia incorporan `id` UUID estable. Se debe conservar al editar/reordenar. `POST /churches/:id/meeting-identifiers`, con permisos de administración de esa iglesia e If-Match, completa identificadores antiguos, incrementando versión sin alterar publicación. El editor vinculado lo utiliza al preparar la lista; volver a Ficha recarga la versión.
- Multimedia de comunidades admite `category: facilities|logo`; de iglesias añade `logo` a las categorías existentes. Upload de comunidad admite `?category=logo&frame=square`. Se conservan límites, permisos, recorte, posición, orden y control de versión. El marco inicial de logo es cuadrado.
- Logos se muestran junto a identidad en fichas públicas. Para ti y búsqueda de iglesias priorizan el primer logo o banner según el orden de recursos; luego aplican los fallbacks existentes. No se añade un nuevo recomendador de comunidades vinculadas.
- Comprobación: linked-communities.test.js (contrato, IDs, privacidad), linked-communities.cjs (logo con proveedor simulado y selección), public-profiles.cjs (logos en fichas, marcos y móvil). Sin servicios reales ni cambios de datos productivos.


### Ubicación explícita de recursos
`media[].section` separa ubicación y categoría: `logo` (junto al nombre), `banner` (cabecera), `facilities` (Visítanos/ubicación), `meetings`, `activities` (Vida en comunidad/Sobre la comunidad), `recommendation` (tarjeta); además `representatives` solo en iglesias y `gallery` solo en comunidades. Un logo puede ubicarse en Reuniones sin dejar de ser logo. Los retratos en Representantes requieren asociación válida.
El selector **Mostrar en** de cada recurso conserva su sección al reordenar. La secuencia global solo determina el orden relativo entre recursos de la misma sección. Una tarjeta usa la primera imagen de su sección. No hay duplicación automática en otras secciones. Cambiar categoría no cambia una sección ya seleccionada.
Sin `section`, los recursos antiguos conservan su ubicación por categoría y las tarjetas mantienen su fallback previo. Seleccionar una sección elimina ese fallback para ese recurso. Los campos se conservan en las APIs públicas y administrativas sin cambiar permisos ni límites.
