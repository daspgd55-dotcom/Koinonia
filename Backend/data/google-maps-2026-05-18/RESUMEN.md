# Limpieza Google Maps — Koinonía

Origen: dataset_crawler-google-places_2026-05-18_18-10-12-993.xlsx; hoja Data.

Filas originales: 495. Importables: 251.

| Resultado | Filas |
|---|---:|
| accepted | 251 |
| excluded | 13 |
| review | 231 |

## Cobertura del conjunto importable

| Campo | Registros |
|---|---:|
| phone | 127 |
| website | 72 |
| facebook | 6 |
| instagram | 6 |
| youtube | 1 |
| openingHours | 109 |

## Criterios

- No se deducen doctrina, liderazgo, idiomas, ministerios ni autorización institucional.
- Las categorías externas permanecen en externalProfile; no se convierten en denominación declarada.
- Horarios de apertura separados de meetings. Se conservan el texto original, cierres, 24 horas y cruces de medianoche.
- Los prefijos AM/PM omitidos se interpretan como el intervalo positivo más corto de hasta 12 horas; revisar el original antes de publicar.
- Comuna tomada del texto del proveedor, sin validación territorial por polígonos. Nunoa se normaliza a Ñuñoa.
- Los lugares de categorías ajenas o ambiguas se conservan en review.ndjson con su fila original y motivo.
- Una categoría Church sin un nombre reconocible como comunidad requiere revisión; no se decide por teología.
- Se deduplica solo por placeId. Nombres o coordenadas compartidas generan alertas, no fusiones.
- El dataset es una captura histórica: capturedAt proviene de scrapedAt, no de la fecha de limpieza.
- Todos se importan en borrador por defecto. Publicación de prueba solo con opción explícita en base _demo.

El informe JSON incluye conciliación fila por fila y huella SHA-256 del archivo original.
