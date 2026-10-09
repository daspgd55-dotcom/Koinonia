# Dataset de comunidades e importación

## Resultado de esta limpieza

Fuente: `dataset_crawler-google-places_2026-05-18_18-10-12-993.xlsx`, hoja `Data`, 495 filas de datos y 31 columnas. El original no se modifica. La captura es del 18 de mayo de 2026, no una comprobación de vigencia actual.

| Destino | Filas | Significado |
|---|---:|---|
| Importables | 251 | Categoría explícita de iglesia/comunidad y nombre compatible según las reglas conservadoras. |
| Revisión | 231 | 169 nombres ambiguos bajo categoría genérica, 54 categorías no concluyentes y 8 conflictos entre nombre y categoría. |
| Apartadas | 13 | Categorías ajenas al catálogo, como comercios, plazas o instituciones educativas. |
| Rechazo técnico | 0 | Ninguna fila de este lote carece de identidad, fecha, localidad o coordenadas estructuralmente válidas. |
| Duplicado por Place ID | 0 | Hay 495 identificadores externos diferentes. |

Los 231 registros en revisión **no equivalen a 231 iglesias inválidas**. Son casos que la regla automática no puede resolver con suficiente claridad. Se conserva su transformación y fila original en `review.ndjson`, junto con las 13 apartadas. No se excluyen comunidades por sus creencias. La clasificación tampoco certifica que las 251 aceptadas sean instituciones reales/verificadas.

En el conjunto importable hay 127 teléfonos normalizados, 72 sitios web, 6 enlaces Facebook, 6 Instagram, 1 YouTube y 109 fichas con horarios de apertura. Los campos restantes quedan ausentes, no inventados.

Archivos en `Backend/data/google-maps-2026-05-18/`:

- `churches.import.ndjson`: lote listo para el importador de Koinonía.
- `review.ndjson`: filas ambiguas/apartadas y evidencia original; **no se importa directamente**.
- `quality-report.json`: clasificación fila por fila, alertas, conteos y SHA-256 del Excel.
- `RESUMEN.md`: resumen de reglas y cobertura.

## Criterios de limpieza

1. Normalizar espacios, espacios Unicode y valores vacíos. Se mantienen nombres y descripciones originales, sin traducción ni corrección especulativa.
2. Construir GeoJSON en orden `[longitud, latitud]`; rechazar valores no finitos, fuera de rango o `[0,0]`.
3. Extraer `query_place_id` del enlace Maps y construir `externalKey = google_maps:<placeId>`.
4. Normalizar teléfonos chilenos a formato `+56...`; omitir los inválidos con alerta. Se detectaron 2 teléfonos inválidos en el archivo completo.
5. Separar enlaces de Instagram, Facebook y YouTube del sitio web general, cuando el dominio permite reconocerlos.
6. Mantener códigos postales como texto. Tomar comuna de segmentos administrativos completos y normalizar `Nunoa` a `Ñuñoa`; no buscar comunas dentro del nombre de la calle.
7. Mantener categorías y fecha de captura bajo `externalProfile`. No convertir la categoría de Maps en doctrina o denominación institucional declarada.
8. Mantener los horarios de Maps como **apertura del lugar**, separados de `meetings` (reuniones/cultos). Conservar también el texto original, los días cerrados y la apertura 24 horas. Para intervalos nocturnos usar `endDayOffset: 1`.
9. Cuando Google omite AM/PM al comienzo, resolver el intervalo positivo más corto de hasta 12 horas. Ejemplo: `11 to 1 PM` -> `11:00–13:00`; `12 to 6 AM` -> `00:00–06:00`. Un texto no interpretable conserva `status: unparsed` y `raw`.
10. Deduplicar únicamente por Place ID, conservando la captura más reciente. Distintos IDs con nombre o coordenadas compartidos generan alertas. Hay 41 filas con coordenadas compartidas y 49 con nombres repetidos; son grupos potencialmente solapados, no conteos de duplicados confirmados.

Todas las comunas proceden del texto de Google y están marcadas como no verificadas geográficamente. El archivo concentra coordenadas entre latitudes -33.4767882 y -33.4306469 y longitudes -70.6799298 y -70.6273484, pero incluye textos de localidades más amplias. Las 17 filas que nombran comunas distintas de Santiago reciben además una alerta específica. No se han usado polígonos oficiales ni geocodificación externa para resolver discrepancias. No es un catálogo de toda la Región Metropolitana.

## Cambios en el modelo Iglesia

| Campo | Uso |
|---|---|
| `location.postalCode` / `countryCode` | Código postal textual y país (`CL`). |
| `externalProfile.provider` / `placeId` | Identidad de la fuente, con índice único compuesto parcial. |
| `externalProfile.mapsUrl` | Enlace para abrir Maps desde la ficha. |
| `externalProfile.sourceTitle` / `subtitle` | Nombre y subtítulo originales del proveedor. |
| `externalProfile.categories` | Categorías externas, sin presentarlas como declaración institucional. |
| `externalProfile.sourceAddress` / `sourceCity` | Evidencia de la localización aportada por el proveedor. |
| `externalProfile.capturedAt` | Fecha histórica de captura; se persiste como Date en MongoDB. |
| `externalProfile.openingHours` | Apertura por día, intervalos y texto original. |
| `importInfo` | Lote, archivo, fila, versión de contrato, fecha de importación y alertas. Se omite de respuestas públicas. |
| `metadata.testData` | Identifica fichas publicadas excepcionalmente para pruebas. |

Los datos externos se conservan cuando se edita la ficha institucional. La API normal rechaza intentos de enviar `externalProfile` o `importInfo` desde el formulario público de comunidades: los controla el importador. La información de Maps no crea representantes autorizados ni se convierte automáticamente en fuentes aprobadas para RAG.

## Importar ahora

Ejecuta los comandos en una **segunda terminal**, desde `Backend`. Puedes mantener `npm.cmd run dev` abierto en la primera. Reinicia el servidor si estabas usando `npm.cmd start`, para que cargue los cambios de modelo.

### 1. Validación sin tocar la base

```powershell
cd C:\Users\david\Documents\python\Koinonia\Backend
npm.cmd run import:churches -- --file data/google-maps-2026-05-18/churches.import.ndjson
```

Resultado esperado: `valid: 251`, `writes: 0`, `databaseConnected: false`. No requiere MongoDB, credenciales ni `.env`; comprueba contrato, relaciones entre campos y modelo Mongoose.

### 2. Elegir cómo cargarlo

**Para ver los datos inmediatamente en la app de pruebas:** configura en `.env` una base terminada en `_demo`, por ejemplo `mongodb://127.0.0.1:27017/koinonia_demo`. Debe existir un administrador activo en esa misma base. Sustituye el correo del comando por el de tu administrador real:

```powershell
npm.cmd run import:churches -- --file data/google-maps-2026-05-18/churches.import.ndjson --admin "tu-correo@example.com" --apply --demo-publish
```

Esta opción permite probar fichas incompletas con `metadata.testData: true`, sin inventar `authorized: true` ni marcar verificaciones. Está bloqueada fuera de bases `_demo` y con `NODE_ENV=production`. La excepción de publicación se limita al importador de pruebas; la API normal mantiene sus requisitos para publicar.

**Para cargar como borradores sujetos a revisión:** usa el mismo comando sin `--demo-publish`:

```powershell
npm.cmd run import:churches -- --file data/google-maps-2026-05-18/churches.import.ndjson --admin "tu-correo@example.com" --apply
```

El importador usa `MONGO_URI` de `.env`. Los borradores aparecen en `GET /api/churches/manage` con token de administrador y quedan fuera del listado público. El importador no crea cuentas ni cambia contraseñas/roles. Si falta un administrador, regístralo y asígnale el rol siguiendo el README, en la base que hayas elegido.

**Decide la modalidad antes de la primera carga.** Repetir el comando omite IDs existentes: no duplica, no actualiza y tampoco cambia borradores a publicados. Así conserva ediciones humanas y fichas desactivadas. Para evaluar otra modalidad, usa otra base `_demo` con su administrador. No borres registros para repetir una prueba.

### 3. Consultar los resultados de prueba

Con publicación demo y la API conectada a la misma base:

```text
http://localhost:3000/api/churches?limit=5
http://localhost:3000/api/churches/nearby?lat=-33.45&lng=-70.65&radius=2
http://localhost:3000/api/churches/search?q=Iglesia
```

Podrás probar listado, distancia, ficha, guardados y descartes. Los filtros de denominación, doctrina y horarios de culto no tendrán información nueva del dataset porque esos campos no se dedujeron de Google. Los datos sintéticos anteriores, si ya existen en tu base, se conservan y pueden aumentar el total del listado.

## Formato recomendado para las próximas entregas

Utiliza **NDJSON / JSON Lines UTF-8**, extensión `.ndjson`: un objeto JSON por línea, con objetos anidados, números y booleanos nativos, sin comentarios y sin un arreglo exterior. Evita CSV para representar horarios, listas, fuentes o GeoJSON: exige volver a interpretar estructuras dentro de celdas.

El contrato versionado del proyecto es `koinonia.church-import.v1`, disponible en [church-import.schema.json](church-import.schema.json). [Ejemplo real de un registro](../data/google-maps-2026-05-18/churches.import.ndjson) (cada línea es independiente):

```json
{
  "schemaVersion": "koinonia.church-import.v1",
  "externalKey": "google_maps:ID_DEL_LUGAR",
  "provenance": {
    "batchId": "lote-con-identidad-estable",
    "sourceFile": "archivo-origen.xlsx",
    "sourceRow": 2,
    "issues": ["commune_from_source_not_geographically_verified"]
  },
  "church": {
    "identification": { "name": "Nombre de la comunidad" },
    "verification": { "source": "google_maps", "authorized": false },
    "location": {
      "address": "Dirección de la fuente",
      "commune": "Santiago",
      "countryCode": "CL",
      "coordinates": { "type": "Point", "coordinates": [-70.65, -33.45] }
    },
    "externalProfile": {
      "provider": "google_maps",
      "placeId": "ID_DEL_LUGAR",
      "mapsUrl": "https://www.google.com/maps/search/?query_place_id=ID_DEL_LUGAR",
      "sourceTitle": "Nombre de la comunidad",
      "categories": ["Church"],
      "sourceAddress": "Dirección de la fuente",
      "sourceCity": "Santiago",
      "capturedAt": "2026-05-18T18:08:42.733Z",
      "openingHours": []
    }
  }
}
```

El ejemplo está expandido para leerlo; en el archivo NDJSON cada objeto ocupa una sola línea. Sustituye los valores de ejemplo por los de la fuente. En este contrato los campos ausentes se omiten, los arreglos vacíos son `[]`, y los identificadores/códigos postales son strings. No uses `NaN`, `undefined`, fórmulas Excel ni cadenas `"null"`. Mantén las fechas ISO 8601 con zona UTC.

El sobre `schemaVersion/externalKey/provenance/church` es el **formato de intercambio de Koinonía**, no el documento final de la colección. El importador lo valida, crea ObjectId/fechas BSON y añade auditoría antes de guardar el contenido de `church`. No inventes `createdBy` ni reutilices IDs de usuario de otra base.

MongoDB también admite [JSON y Extended JSON mediante mongoimport](https://www.mongodb.com/docs/database-tools/mongoimport/). Para una importación directa a la colección se necesitarían documentos finales con tipos correctos, incluyendo `{"$oid":"..."}` para referencias y `{"$date":"..."}` para fechas. Aquí es preferible el importador del proyecto: `mongoimport` no ejecuta las reglas de Mongoose y cargar el sobre de intercambio directamente produciría una estructura incorrecta. La opción `upsert` de mongoimport puede reemplazar documentos existentes; este importador omite los existentes deliberadamente.

La versión 1 admite Google Maps. Para OpenStreetMap u otra fuente se debe crear su adaptador y ampliar el contrato de proveedor; el objetivo es mantener la misma forma de ficha y procedencia, sin forzar otra fuente a tener Place ID de Google.

## Repetir la ETL desde otro Excel equivalente

```powershell
python -m venv .venv-etl
.\.venv-etl\Scripts\python.exe -m pip install -r scripts/etl/requirements.txt
.\.venv-etl\Scripts\python.exe scripts/etl/google_maps.py --input "C:\ruta\nuevo-export.xlsx" --output data/nuevo-lote
npm.cmd run import:churches -- --file data/nuevo-lote/churches.import.ndjson
```

Usa una carpeta de salida diferente por lote. El adaptador espera las columnas del export actual, en la hoja `Data` o, si no existe, la primera hoja. Si cambia el proveedor, la estructura o la región, adapta el mapeo antes de importar. Para aprobar un registro revisado, corrige su `record`, guarda ese objeto como una línea del nuevo lote y valida; no importes el contenedor `disposition/reason/original` de `review.ndjson`.

## Seguridad de carga y pruebas

La validación termina antes de escribir. Un error de formato impide la carga completa. Una interrupción de MongoDB durante la escritura puede dejar una carga parcial; reejecutar omite los IDs ya cargados y continúa. No se promete atomicidad de lote. No hay actualización masiva automática ni borrados. El índice único evita duplicados concurrentes por proveedor/Place ID.

```powershell
npm.cmd test
.\.venv-etl\Scripts\python.exe -m unittest discover -s scripts/etl -p "test_*.py" -v
```

En esta entrega pasaron 21 pruebas Node (incluida importación de las 251 comunidades en MongoDB temporal) y 7 pruebas Python de ETL. Se verificaron fechas, orden de coordenadas, preservación de ediciones, rechazo de lotes inválidos, publicación demo, permisos y regresiones de la API. No se cargó el dataset en tu base configurada.

## Lotes enriquecidos y actualización de registros existentes

El export del 30 de septiembre incluye categorías en español, imágenes y perfiles sociales. Su adaptador es `scripts/etl/google_maps_rich.py`. El comando `npm run merge:churches` añade una conciliación con respaldo y reporte para actualizar fichas existentes. La importación anterior conserva su comportamiento de omitir existentes.

Consulta [el resultado aplicado, criterios de merge y comandos](../data/google-maps-2026-09-30/RESUMEN.md). Dirección y código postal se utilizan como señales de identidad; el código postal solo no permite fusionar comunidades. La ampliación del contrato v1 incorpora campos opcionales de enlaces, teléfonos, correos y fundamento de fecha dentro de `externalProfile`; los lotes anteriores siguen siendo válidos.
