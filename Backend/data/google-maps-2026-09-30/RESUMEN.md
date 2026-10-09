# Lote Google Maps del 30 de septiembre de 2026

Fuente: `dataset_crawler-google-places_2026-09-30_19-48-48-079.xlsx`, hoja Data, 101 filas y 153 columnas. Original intacto. SHA-256 y clasificación por fila en `quality-report.json`.

## Resultado aplicado

Base: `koinonia_demo`. Antes: 254 iglesias. Después: 263.

| Resultado | Filas |
|---|---:|
| Fichas existentes enriquecidas | 54 |
| Iglesias incorporadas | 9 |
| Revisión de clasificación | 27 |
| Revisión de identidad al conciliar | 2 |
| Entidades ajenas apartadas | 9 |
| Total | 101 |

Las 63 fichas procesadas contienen 104 URLs de imágenes en 58 fichas y 79 enlaces externos adicionales. Las nuevas se publicaron como datos de prueba exclusivamente en la base `_demo`. No se otorgó autorización institucional ni verificación. Se conservaron los estados y permisos de las fichas existentes.

## Reglas de conciliación

1. El mismo Place ID identifica una ficha existente; también se reconocen los alias registrados en fusiones.
2. Dirección normalizada con número y comuna, corroborada por nombre coincidente o muy similar: permite combinar. Dirección sin número no es clave suficiente.
3. Dirección compartida con nombres distintos, varias coincidencias, o nombre igual con dirección diferente: revisión, sin escribir esa fila.
4. Código postal por sí solo NO identifica una iglesia. Se registra como candidato; si además existe nombre similar se retiene para revisión. Iglesias diferentes pueden compartir código postal.
5. Se completan campos vacíos y se unen medios, teléfonos, correos y enlaces externos. Valores institucionales existentes, identidad, representantes, autorización y estado se conservan. Los conflictos escalares se registran en `merge-result.json`; los valores entrantes permanecen en el lote y evidencia original.
6. No se eliminan fichas antiguas ni se trasladan interacciones entre IDs. Los casos inciertos quedan separados para revisión.
7. Cada modificación incrementa la versión y registra el administrador editor. Un segundo recorrido confirmó 63 fichas sin cambios y 2 pendientes; cero nuevas inserciones o actualizaciones.

Casos de identidad pendientes:
- Sede Iglesia Presbiteriana Nacional (IPNA) comparte Av. Brasil 153 con SANTISIMA TRINIDAD, pero no se asume que sean la misma entidad.
- Iglesia Cristiana La Roca tiene coincidencia de nombre y direcciones distintas (Agustinas / Libertad); requiere comprobar si es traslado, sede o duplicado.

## Atributos e imágenes

`media` conserva URLs HTTP/HTTPS de Maps y de perfiles sociales, deduplicadas por URL exacta, con `source` indicando la columna de origen. No se descargaron imágenes ni se modificó la interfaz. Las fotos de perfil/portada son candidatos externos, no imágenes institucionales verificadas. Pueden incluir logos, imágenes de Street View o enlaces temporales; deben revisarse antes de presentarlas como fotografía de la iglesia.

`externalProfile.links`, `phones` y `emails` conservan los valores adicionales sin imponerlos como contacto principal. Se conservan los atributos sociales originales en `source-rows.ndjson`; contadores de seguidores, datos de cuentas y descripciones sociales no se convierten en características de la iglesia. Las URLs con firmas o parámetros se preservan, evitando romper su acceso.

El export no incluye `scrapedAt`. `capturedAt` utiliza la marca del nombre del archivo como valor técnico UTC provisional, con `capturedAtBasis: export_filename_timezone_unknown` y una alerta explícita. NO representa una hora de captura comprobada ni una conversión confirmada de zona horaria. Para perfiles previos se conserva su fecha y fundamento existentes. El lote y su procedencia completa se identifican en los informes y las filas originales.

## Archivos

- `churches.import.ndjson`: 65 candidatos válidos para conciliación; incluye los dos retenidos por identidad.
- `review.ndjson`: 27 registros ambiguos y 9 apartados, con motivo y datos originales.
- `source-rows.ndjson`: evidencia de las 101 filas, incluyendo campos no promovidos al modelo.
- `merge-result.json`: acciones efectivamente aplicadas, IDs, conflictos y ubicación del respaldo previo.
- `verification-plan.json`: comprobación posterior sin escrituras.

El respaldo se conserva localmente en `Backend/.cache/import-backups/`; la ruta exacta está en `merge-result.json`. Incluye iglesias, no cuentas ni contraseñas. No debe borrarse mientras se revisa la carga.

## Repetir o preparar otro lote

Desde Backend, con las dependencias de ETL instaladas:

```powershell
python scripts/etl/google_maps_rich.py --input "C:\ruta\dataset_2026-09-30_19-48-48-079.xlsx" --output data/nuevo-lote
npm.cmd run import:churches -- --file data/nuevo-lote/churches.import.ndjson
npm.cmd run merge:churches -- --file data/nuevo-lote/churches.import.ndjson --admin correo-admin --report data/nuevo-lote/plan.json
```

El primer comando transforma; el segundo solo valida; el tercero consulta la base y genera el plan sin escrituras. Para aplicar se añade `--apply`. Para publicar NUEVAS fichas como pruebas se añade `--demo-publish`, restringido a bases `_demo` fuera de producción. No reutilizar la misma ruta de informe si se quiere conservar el resultado de una ejecución anterior.

La carga no es una transacción de lote. Un fallo puede dejar progreso parcial, registrado en el informe; repetir vuelve a conciliar. Evitar ejecutar dos importadores simultáneamente o editar las mismas fichas durante la carga. El guardado comprueba versión y Mongoose controla concurrencia.

## Verificación

Pasaron 9 pruebas Python de ETL y 3 pruebas específicas de conciliación Node, incluida aplicación real y repetición en MongoDB temporal. La suite general pasó 24 de 25 pruebas al ejecutarse antes de añadir la prueba de integración: el único fallo fue una aserción anterior de la interfaz que espera «Laboratorio de servicios», mientras el HTML dice «Test de servicios». Ese texto y la interfaz no se modificaron en esta tarea.
