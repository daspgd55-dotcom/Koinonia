# Consolidación de datos para revisión — 30-09-2026

Se revisaron los archivos `review.ndjson` generados desde las capturas de Google Maps. El inventario conserva 298 ocurrencias, 260 identificadores de lugar únicos y 15 registros cuya identidad no pudo resolverse con seguridad.

## Criterios aplicados

- Se aceptaron fichas plausibles como datos de prueba aunque su actividad actual no pueda verificarse. En ese caso se marca `reviewImport.activityStatus: "unverified"`.
- Se excluyeron cierres explícitos, entidades administrativas o asociaciones sin identidad de iglesia local, personas y lugares dañados sin evidencia de una comunidad operativa.
- Para duplicados se priorizó el registro con mayor completitud y una fecha de captura real. Las fechas inferidas desde el nombre del archivo se trataron como provisionales.
- Los registros secundarios complementaron campos vacíos del ganador. El código postal por sí solo nunca fue suficiente para fusionar.
- La coincidencia combinó `placeId`, dirección normalizada y nombre; se protegieron registros institucionales o ya autorizados.
- Las fuentes y las interacciones se trasladan al registro ganador cuando existen. El duplicado queda inactivo con `mergedInto` para conservar trazabilidad.

## Resultado aplicado

La operación se ejecutó sobre `koinonia_demo`:

- Antes: 264 documentos.
- Después: 343 documentos; 336 activos y 7 inactivos.
- 79 fichas nuevas de prueba.
- 18 fichas enriquecidas o fusionadas con registros existentes.
- 5 fichas excluidas y desactivadas.
- 2 duplicados retirados mediante `mergedInto`.

Los datos importados conservan las URLs de imágenes recibidas, sin descargar ni transformar esos recursos.

La operación es idempotente: una segunda ejecución en modo planificación no produjo acciones nuevas (`alreadyProcessed: 105`, `counts: {}`).

## Respaldo

Antes de escribir se generó un respaldo de iglesias, fuentes e interacciones en [1790801843577-review.json](../../.cache/import-backups/1790801843577-review.json).

Para inspeccionar o repetir la planificación:

```powershell
cd Backend
node scripts/consolidate-review.js --admin daspgd55@gmail.com
```

Para aplicar una nueva revisión se debe revisar primero el plan y ejecutar explícitamente `--apply` con el administrador autorizado.
