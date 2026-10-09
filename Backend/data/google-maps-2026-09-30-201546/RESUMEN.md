# Importación Google Maps — lote 2026-09-30 20:15:46

Fuente: dataset_crawler-google-places_2026-09-30_20-15-46-268.xlsx. 64 filas, 74 columnas. SHA-256 y clasificación completa en quality-report.json. Original intacto.

## Resultado aplicado en koinonia_demo

| Resultado | Registros |
|---|---:|
| Nuevas iglesias | 1 |
| Fichas enriquecidas | 43 |
| Existentes sin novedades | 4 |
| Revisión de clasificación | 11 |
| Revisión de identidad | 2 |
| Entidades ajenas apartadas | 3 |
| Total de filas | 64 |

La base pasó de 263 a 264 iglesias. La incorporación fue Iglesia Adventista del Séptimo Día - CENTRAL, publicada expresamente como dato de prueba (metadata.testData), sin autorización ni verificación institucional.

Se añadieron 106 referencias de imagen por ficha; la colección contiene ahora 210. Se deduplican URLs exactas dentro de cada ficha. URLs diferentes pueden representar la misma fotografía o una variante de tamaño: no se descargaron ni compararon imágenes visualmente. Enlaces, teléfonos y correos complementarios se conservan como información externa, sin sustituir contactos institucionales existentes.

Este export sí contiene scrapedAt; se conserva su fecha de origen en el lote. Las fichas existentes mantienen la fecha de su perfil previo según las reglas de enriquecimiento; el informe y source-rows.ndjson conservan la procedencia de esta actualización.

## Pendientes

Los 11 registros cuya clasificación requiere revisión están en review.ndjson, junto con los 3 apartados (Sociedad Pesquera Holando Chilena Limita, Hostal P Gustavo y Antonio Juan Bautista Salamero Baldrich). Iglesia quemada y Cuaresma de Fraternidad se retuvieron: su categoría no basta para confirmar una comunidad activa. No se eliminaron versiones anteriores de esas fichas de la base.

Dos candidatos adicionales quedaron sin aplicar por identidad:
- Sede Iglesia Presbiteriana Nacional (IPNA) comparte dirección con SANTISIMA TRINIDAD.
- Basílica de Nuestra Señora del Perpetuo Socorro comparte dirección con Congregacion Santisimo Redentor.

No se fusionaron por dirección o código postal sin corroboración suficiente. El detalle está en merge-result.json.

## Respaldo y comprobación

merge-result.json registra el respaldo previo en Backend/.cache/import-backups/, IDs y conflictos conservados. verification-plan.json confirma 48 fichas sin cambios y 2 casos de identidad pendientes al repetir la conciliación: cero nuevas escrituras necesarias. Pasaron las 9 pruebas Python del ETL. No se modificó la interfaz.

Para volver a comprobar desde Backend sin escribir:

```powershell
npm.cmd run merge:churches -- --file data/google-maps-2026-09-30-201546/churches.import.ndjson --admin daspgd55@gmail.com --report .cache/check-201546.json --demo-publish
```

La evidencia completa del export permanece en source-rows.ndjson; las categorías y propiedades adicionales no se convierten automáticamente en doctrina, autorización ni atributos institucionales.
