# Koinonía — backend Hito 2

API REST con Node.js, Express y MongoDB. Incluye autenticación, roles, comunidades, búsqueda geográfica, guardados/descartes, fuentes institucionales y un contrato para integrar el recomendador Python. Las interfaces React/Kotlin y el LLM/RAG real quedan para etapas posteriores.

## Requisitos

- Node.js 22.13 o superior (probado con Node 24).
- MongoDB 8, local o Atlas. Docker es una opción para levantar MongoDB, no un requisito del código.
- Python 3.10+ solamente si se utiliza el adaptador externo opcional.

Ejecuta los comandos siguientes desde `Backend`. En PowerShell, usa `npm.cmd` si la política de ejecución bloquea `npm.ps1`.

## Instalación y ejecución

```powershell
cd C:\Users\david\Documents\python\Koinonia\Backend
npm.cmd ci
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copia el secreto generado en `JWT_SECRET` dentro de `.env`. Configura `MONGO_URI` y, para el frontend, `CORS_ORIGINS`. El servidor rechaza el secreto de ejemplo. `.env` no se versiona.

MongoDB local con Docker, si está instalado:

```powershell
docker compose up -d mongo
npm.cmd run dev
```

Alternativamente, inicia tu instalación local de MongoDB o usa una URI de Atlas y ejecuta `npm.cmd start`. Atlas requiere credenciales y autorización de red propias. El arranque espera la conexión y creación de índices; si falla, termina con código distinto de cero. No se ha configurado una cuenta de Atlas ni credenciales reales.

Usa **solo uno** de los comandos de arranque: `npm.cmd run dev` reinicia automáticamente cuando editas código; `npm.cmd start` ejecuta sin ese reinicio. Deja esa terminal abierta mientras pruebas la API. Ejecuta los comandos de los siguientes apartados en **otra terminal PowerShell**, situada también en `Backend`.

Abre **http://localhost:3000/testing/** para usar la interfaz de pruebas de iglesias. En desarrollo, `/` redirige a ella. No requiere otro servidor ni compilar un frontend. `/api` sigue siendo solo un prefijo y devuelve `NOT_FOUND`; las rutas completas se listan más abajo.

La [guía de la interfaz y recorrido CRUD](docs/testing-ui.md) explica cómo iniciar sesión, crear, consultar, editar, publicar, desactivar y restaurar una comunidad. Si el servidor estaba abierto antes de incorporar estos archivos, reinícialo. El panel se deshabilita con `ENABLE_TEST_UI=false` y en producción; es una herramienta de desarrollo, no la interfaz final React/Kotlin.

Puedes abrir estas direcciones en el navegador:

- `http://localhost:3000/health`: debe mostrar `{ "status": "ok" }`.
- `http://localhost:3000/api/churches`: muestra las comunidades públicas; `data: []` es normal si aún no publicaste ninguna.

El navegador realiza consultas GET al abrir una dirección. Para registrar usuarios o iniciar sesión necesitas enviar solicitudes POST con datos; los comandos PowerShell del siguiente apartado lo hacen. Se pegan en la terminal, no en un archivo de código ni en la barra del navegador.

## Primer usuario y administrador

Con el servidor todavía ejecutándose en la primera terminal, abre una segunda y entra al directorio:

```powershell
cd C:\Users\david\Documents\python\Koinonia\Backend
```

El registro público crea un `user` pendiente de verificación de correo. Configura el remitente y verifica el enlace recibido antes de iniciar sesión; contrato y transición de cuentas existentes en [Seguridad de cuentas](docs/account-security.md). No acepta un campo `role`. La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes UTF-8; se almacena con bcrypt. JWT dura una hora y usa `Authorization: Bearer <token>`.

```powershell
$base = 'http://localhost:3000/api'
$credentials = @{ email = 'admin@example.test'; password = 'UnaClaveLocalLarga-123' } | ConvertTo-Json
Invoke-RestMethod "$base/auth/register" -Method Post -ContentType 'application/json' -Body $credentials
# Verificar primero el correo mediante el enlace recibido (el ejemplo requiere un buzón real).
npm.cmd run user:role -- admin@example.test admin
$session = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body $credentials
$headers = @{ Authorization = "Bearer $($session.token)" }
Invoke-RestMethod "$base/users/me" -Headers $headers
```

La contraseña anterior es un ejemplo local: usa una propia. El comando `user:role` requiere acceso directo a la base y sirve para el primer administrador o recuperación operativa. No es un endpoint público. Después, un administrador puede cambiar roles mediante la API, salvo su propio rol. Cada solicitud consulta el rol y estado actuales en MongoDB, por lo que una degradación de rol tiene efecto aun con tokens previamente emitidos.

Ejecuta el bloque en orden y en la misma segunda terminal para conservar sus variables. El registro crea la cuenta, `user:role` la convierte en administrador, login obtiene el token y la última consulta muestra el perfil con `role: admin`. Si ya registraste ese correo, no repitas el registro: continúa con la asignación de rol y el login. Un error `CONFLICT` al registrar indica que esa cuenta ya existe.

| Rol | Alcance |
|---|---|
| `user` | Perfil propio, preferencias, guardados, descartes y recomendaciones. |
| `representative` | Consulta y actualiza solo las comunidades asignadas. |
| `admin` | Administra todas las comunidades, asigna representantes y roles, publica/verifica fichas y aprueba fuentes. |

## Datos de demostración

También está disponible el [dataset limpio de Google Maps y su guía de importación](docs/dataset-import.md): 251 comunidades candidatas importables, separadas de los registros que requieren revisión. El importador valida sin escribir por defecto y permite publicarlas expresamente para pruebas en una base `_demo`.

Para evitar mezclarlos con datos reales, el importador solo acepta una base cuyo nombre termine en `_demo`, por ejemplo `mongodb://127.0.0.1:27017/koinonia_demo`. Cambia `MONGO_URI`, reinicia la API y registra/promueve el administrador en esa base antes de ejecutar:

```powershell
npm.cmd run seed -- admin@example.test --confirm-demo
```

Crea tres comunidades **ficticias**, sin borrar ni sobrescribir registros existentes. Requiere un administrador activo ya registrado: no crea cuentas ni cambia contraseñas. Las coordenadas son de prueba y no identifican comunidades reales. El script rechaza `NODE_ENV=production`.

## API

El backend de RF-05 dispone de eventos independientes de reuniones y primeras visitas: [contrato de eventos, permisos, fechas y pruebas](docs/events.md). Incluye borradores, publicación, cancelación y consulta pública; interfaces, asistencia y notificaciones de eventos permanecen pendientes.

Las respuestas utilizan `{ "data": ... }`; las listas incorporan `pagination` donde corresponde. Login incluye además `token`, `tokenType` y `expiresIn`. Los errores tienen `{ "error": { "code", "message", "details"? } }`. Las eliminaciones exitosas responden `204` sin cuerpo.

| Método y ruta, relativas a `/api` | Acceso | Operación |
|---|---|---|
| `POST /auth/register` | Público | Registro pendiente: email, password, name opcional. 202 genérico; requiere verificación. |
| `POST /auth/login` | Público | Obtener token. |
| `GET /users/me` | Sesión | Perfil propio sin hash de contraseña. |
| `PUT /users/me/preferences` | Sesión | Reemplazar preferencias propias. |
| `PATCH /users/:id/role` | Admin | Body: `{ "role": "representative" }`. |
| `GET /churches` | Público | Fichas publicadas/verificadas y activas. |
| `GET /churches/search` | Público | Misma búsqueda, con filtros combinables. |
| `GET /churches/nearby` | Público | Búsqueda geográfica; requiere lat y lng. |
| `GET /churches/manage` | Representante/admin | Listado de gestión, incluidos borradores propios. |
| `GET /churches/manage/:id` | Representante asignado/admin | Ficha completa, incluso desactivada; devuelve ETag de versión. |
| `GET /churches/:id` | Público | Ficha pública individual. |
| `POST /churches` | Admin | Crear borrador; asigna al creador. |
| `PUT /churches/:id` | Representante asignado/admin | Reemplazar ficha editable y devolverla a borrador. |
| `PATCH /churches/:id/status` | Admin | Body: `{ "status": "draft\|published\|verified" }`. |
| `PUT /churches/:id/representatives` | Admin | Body: `{ "userIds": ["ObjectId"] }`. |
| `DELETE /churches/:id` | Admin | Desactivación lógica, conserva los datos. |
| `POST /churches/:id/restore` | Admin | Restaurar una ficha desactivada como borrador. |
| `POST /interactions` | Sesión | Guardar o descartar una comunidad. |
| `GET /users/me/interactions` | Sesión | Selecciones propias; filtro `type=saved` o `discarded`. |
| `DELETE /interactions/:churchId` | Sesión | Quitar selección propia, de forma idempotente. |
| `GET /churches/:id/sources` | Público | Fuentes aprobadas de ficha pública. |
| `POST /churches/:id/sources` | Representante asignado/admin | Añadir fuente pendiente. |
| `GET /sources/pending` | Admin | Revisar fuentes pendientes. |
| `PATCH /sources/:sourceId/status` | Admin | Body: `{ "status": "approved" }` o `pending`. |
| `POST /recommendations` | Sesión | Ranking estructurado e integración externa opcional. |

Los campos no contemplados en los cuerpos se rechazan. Los IDs deben ser ObjectId de 24 caracteres hexadecimales. Las rutas anteriores sin `/api` y el formato antiguo de encuesta dejaron de ser el contrato vigente.

### Modelo y publicación de comunidades

La ficha incluye `identification`, `verification`, `location`, `christianIdentity`, `doctrine`, `meetings`, `community`, `leadership`, `contact`, `firstVisit`, `media` y `metadata`. Se agregan campos de control: representantes autorizados, creador, último editor, fechas, versión y estado activo.

Ejemplo completo mínimo para poder publicar; puede enviarse como JSON a `POST /api/churches`:

```json
{
  "identification": { "name": "Comunidad ficticia de prueba", "description": "Datos de demostración" },
  "verification": { "authorized": true, "source": "formulario-institucional" },
  "location": {
    "address": "Dirección de prueba",
    "commune": "Santiago",
    "coordinates": { "type": "Point", "coordinates": [-70.65, -33.45] }
  },
  "christianIdentity": { "branch": "Protestante", "denomination": "Bautista", "languages": ["Español"] },
  "doctrine": { "officialStatement": "Declaración institucional de ejemplo", "characteristics": ["Formación bíblica"] },
  "meetings": [{
    "type": "Culto principal", "modality": "Presencial",
    "schedule": [{ "day": "Domingo", "startTime": "10:00", "durationMinutes": 90 }]
  }],
  "community": { "activities": ["Jóvenes", "Ayuda social"] },
  "leadership": { "mainLeader": { "name": "Responsable ficticio", "role": "Pastor" } }
}
```

Crear requiere nombre, comuna y coordenadas válidas. Publicar exige también dirección, denominación, declaración doctrinal, reuniones, liderazgo, fuente y autorización institucional declarada. `verified` es una decisión explícita del administrador, no una deducción automática.

`PUT` reemplaza los grupos editables completos: los grupos opcionales omitidos se eliminan. No acepta `metadata`, representantes, autor o estado activo en el body. Toda edición vuelve la ficha a borrador para revisión; se incrementa la versión y se registra el último editor. La concurrencia optimista evita sobrescribir silenciosamente una edición simultánea. Esto es trazabilidad básica, no un historial completo de revisiones.

La respuesta pública omite IDs de representantes/editores y los datos privados del informante. Las redes y contactos en `contact` son canales institucionales destinados a publicación. `authorized` registra la declaración del informante; no sustituye el proceso humano de comprobación.

El cliente puede enviar `If-Match: "3"` (versión recibida en `metadata.version` o en el ETag de la ficha privada) al editar, cambiar estado/representantes, desactivar o restaurar. Si la versión cambió, recibe `409 STALE_VERSION`; debe recargar antes de reintentar. La interfaz de pruebas siempre envía esta condición para impedir que una ficha abierta sobrescriba cambios posteriores. El encabezado es opcional para compatibilidad con clientes anteriores.

El listado privado admite `q`, `commune`, `denomination`, `status=draft|published|verified`, `active=active|inactive|all`, `page` y `limit`. Por defecto muestra solo activas; representantes solo ven sus asignaciones. Ejemplo: `/api/churches/manage?active=inactive&page=1&limit=20`.

### Búsqueda geográfica y filtros

```text
GET /api/churches/nearby?lat=-33.45&lng=-70.65&radius=5&denomination=Bautista&page=1&limit=20
GET /api/churches/search?commune=Santiago&activity=Jóvenes&day=Domingo
```

Filtros: `q` (nombre, búsqueda literal parcial), `commune`, `denomination`, `branch`, `doctrine`, `activity`, `language`, `day`. Se combinan con AND. Los filtros textuales exactos ignoran mayúsculas, pero no eliminan tildes. Usa los días en español y con tildes.

Paginación: `page=1`, `limit=20`, máximo 100. Si se proporciona ubicación, ambas coordenadas son obligatorias. `radius` se expresa en kilómetros, por defecto 5 y máximo 200. Los resultados geográficos incluyen `distanceMeters` y se ordenan por cercanía. Son distancias esféricas, no rutas de viaje.

GeoJSON usa **longitud, latitud** y el índice `2dsphere` se crea en `location.coordinates`. La implementación sigue la [documentación de MongoDB para consultas geográficas](https://www.mongodb.com/docs/manual/reference/operator/aggregation/geoNear/). Las restricciones del modelo complementan la validación de entrada; los índices únicos resuelven duplicados, según las [reglas de validación de Mongoose](https://mongoosejs.com/docs/validation).

### Guardados, descartes y preferencias

```json
{ "churchId": "ObjectId", "type": "discarded", "reason": "Prefiero otro horario" }
```

Cada pareja usuario/comunidad tiene una sola selección vigente. Repetir la solicitud no duplica registros; `saved` reemplaza `discarded` y viceversa. Guardar elimina el motivo previo. El motivo es opcional y solo se acepta para descartes. Estas selecciones son privadas. Si una comunidad deja de estar publicada, el listado conserva la interacción, pero devuelve `church: null`.

Preferencias admitidas: `commune`, `denominations`, `branches`, `doctrinalTags`, `activities`, `languages`, `meetingDay`, `radiusKm`, `location: { lat, lng }`. Son opcionales. El cliente puede usar solo comuna y no enviar coordenadas. No se usa IP ni se obtiene ubicación automáticamente.

## Recomendador

```json
{
  "query": "Busco una comunidad con actividades juveniles",
  "location": { "lat": -33.45, "lng": -70.65 },
  "preferences": { "denominations": ["Bautista"], "activities": ["Jóvenes"], "radiusKm": 5 },
  "limit": 10
}
```

Sin `RECOMMENDER_URL`, la API funciona de forma determinista. Usa las preferencias guardadas y aplica encima las preferencias enviadas. Un arreglo vacío elimina esa restricción para la solicitud. `location` de la solicitud tiene precedencia sobre la guardada. Dentro de denominaciones, ramas e idiomas se admite cualquiera de las alternativas; actividades y etiquetas doctrinales deben cumplirse todas. Se excluyen descartes, borradores e inactivos.

Puntaje provisional: `0.40 doctrina + 0.25 distancia + 0.20 actividades + 0.10 idioma/horario + 0.05 calidad`. Cada componente está en `[0,1]`; los criterios no solicitados o sin información aportan cero. Calidad vale 1 para ficha verificada y 0.5 para publicada. La distancia decrece linealmente hasta el radio solicitado. Los pesos no han sido validados con usuarios y no representan probabilidades de satisfacción.

Se evalúan como máximo 100 candidatos, tras aplicar filtros. Con ubicación se consideran los más cercanos; sin ubicación, los primeros por ID. `meta.truncated` avisa si hay más. Devuelve hasta 20 resultados (10 por defecto), sus componentes y explicación. Todavía no hay umbral mínimo validado.

**La consulta libre no se interpreta en esta base.** Se devuelve `queryInterpreted: false` y una advertencia si hay `query`. No se presenta el ranking estructurado como si fuera RAG. El servicio externo preparado en esta entrega solo puede enriquecer explicaciones; no puede cambiar filtros, IDs ni puntuaciones. El contrato se describe en [docs/recommender-contract.md](docs/recommender-contract.md).

### Adaptador Python opcional

```powershell
cd SR
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
$env:RECOMMENDER_TOKEN = 'un-secreto-interno-propio'
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

En `.env` del backend, configura `RECOMMENDER_URL=http://127.0.0.1:8000/recommend` y el mismo `RECOMMENDER_TOKEN`; reinicia Node. Python no lee automáticamente el `.env` del backend. Sin token, el adaptador está pensado solo para desarrollo en loopback. Tiene Swagger en `/docs`. Es un adaptador **baseline**, sin proveedor LLM ni índice vectorial. Node puede ejecutarse sin Python.

## Pruebas

```powershell
npm.cmd test
npm.cmd run test:ui
```

Las pruebas arrancan MongoDB 8.0.12 temporal con `mongodb-memory-server`, sin utilizar `MONGO_URI` ni tocar bases existentes. La primera ejecución descarga el binario oficial (aproximadamente 749 MB en Windows) a `.cache/mongodb`. Las siguientes reutilizan la caché. El proceso temporal se detiene al finalizar. Requiere red la primera vez y permiso para iniciar procesos locales. También se puede indicar un binario compatible mediante `MONGOMS_SYSTEM_BINARY`.

Se comprueban registro, hashes, autenticación, roles actuales, aislamiento por representante/usuario, publicación, validación, geografía real, guardados/descartes, filtros del ranking y respuestas externas inválidas/lentas. El proveedor externo de pruebas es un servidor HTTP local controlado, no un LLM real.

Pruebas HTTP del adaptador opcional, después de instalar sus dependencias:

```powershell
cd SR
.\.venv\Scripts\python.exe -m unittest -v test_adapter
.\.venv\Scripts\python.exe -m pip check
```

`npm.cmd test` pasó 23 pruebas Node/MongoDB. `test:ui` pasó el recorrido CRUD en un navegador real con una base temporal independiente; en Windows usa Microsoft Edge instalado. En otros sistemas instala Chromium con `npx playwright install chromium`; consulta los detalles en la guía de la interfaz. Las capturas quedan en `.cache/ui-check/`.

`requirements.txt` define rangos compatibles y `requirements.lock.txt` fija las versiones del adaptador Python. Sus pruebas son independientes y no se volvieron a ejecutar para este cambio de interfaz. Los scripts de rol y datos ficticios también se ejecutan en las pruebas Node contra bases temporales.

## Alcance y siguientes etapas

- Implementado: RF-01/RF-02, persistencia y API de ficha RF-03, guardados/descartes de RF-04, estructura para actividades/contactos/medios, base de RF-09 y administración de RF-10.
- La comparación visual, reseñas/moderación de experiencias, contacto con consentimiento, eventos independientes y registro histórico de todas las interacciones siguen pendientes.
- Las fuentes se registran y aprueban, pero no se descargan URLs ni se extraen PDFs. Faltan ingestión documental, fragmentación, embeddings, índice vectorial, interpretación de consultas y evaluación de explicaciones RAG.
- No hay recuperación de contraseña, verificación de correo, refresh tokens ni cierre de sesión con revocación individual. Los tokens expiran en una hora; desactivar una cuenta invalida su acceso inmediatamente.
- El limitador de autenticación usa memoria del proceso. Para múltiples réplicas se necesita almacenamiento compartido. No se ha configurado un proxy de producción ni despliegue HTTPS.
- El esquema nuevo no migra documentos anteriores. Usa una base nueva para comenzar; no apuntes a una base antigua con información útil sin preparar una migración. La aplicación no elimina bases existentes.
- Se preparó un dataset de Google Maps con importador y control de calidad. Su carga en tu base es explícita; consulta [la guía del dataset](docs/dataset-import.md).

## Organización

```text
src/
  app.js                  # Express sin conexión ni escucha al importarlo
  server.js               # Arranque, conexión y cierre
  config/                 # Entorno e índices
  models/                 # Usuarios, comunidades, selecciones y fuentes
  validation/             # Contratos de entrada estrictos
  middleware/             # JWT y roles
  controllers/            # Casos de uso de la API
  services/               # Búsqueda, acceso y recomendación
  routes/api.routes.js    # Contrato HTTP
scripts/                  # Roles por consola y datos ficticios
test/                     # Integración con MongoDB temporal
SR/                       # Adaptador Python opcional
```

## Perfil e incorporación

La encuesta inicial v2 de cuatro pasos y la configuración detallada independiente disponen de guardado parcial mediante `PATCH /api/users/me`, contexto de búsqueda, estados `pending/completed/skipped` y modos `preferred/required/disabled` por criterio. El contrato, compatibilidad y ejemplos están en [Encuesta y perfil](docs/onboarding-profile.md). Las descripciones anteriores de filtros obligatorios y límite de 100 se refieren al contrato legado sin modos explícitos; el ranking personalizado evalúa todos los candidatos elegibles mediante cursor. El cliente React en Frontend usa estos endpoints, con dirección privada opcional, ubicación voluntaria y un deslizador de distancia. Las restricciones se editan mediante casillas en la configuración del perfil.


## Panel React de administración

Ver `docs/community-management.md` para permisos, atributos de la ficha Forms, contrato adicional y pruebas del panel `#/administracion`.
