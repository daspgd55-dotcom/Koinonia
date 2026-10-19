# Datos de prueba para Koinonía

Este lote contiene 336 fichas reconstruidas del ETL histórico: 302 tienen enriquecimiento sintético y 34 conservan sus carencias originales como controles. No es una exportación de la base actual ni información validada por representantes.

## Archivos

- `churches.test.ndjson`: una ficha por línea, con el objeto `church`, identificador propio de prueba y procedencia por campo.
- `rag.test.ndjson`: un documento por ficha, con atributos simulados explícitos. Permite ensayar recuperación y referencias; no constituye evidencia sobre iglesias reales.
- `report.json`: cantidades, cobertura, limitaciones y hashes de las fuentes para reproducir el lote.

Se enriquecen campos vacíos de rama, denominación, idiomas, actividades, ministerios, públicos, estilos, doctrina, reuniones, accesibilidad, estacionamiento y recepción de visitas, según el escenario. Se conservan los valores preexistentes. Si solo había rama o denominación, no se inventa su pareja para evitar una clasificación inconsistente con lo heredado. Los atributos asignados son combinaciones de prueba y no representan prevalencias ni perfiles doctrinales reales. No se inventan contactos, representantes ni declaraciones institucionales.

Las 268 fichas del escenario `enriched` reciben el conjunto amplio de atributos; 34 del escenario `partial_enrichment` reciben menos campos. Estos nombres indican el tratamiento aplicado, no garantizan completitud absoluta. Otras 34 son controles `original_missing_data`. Los valores heredados tampoco se consideran verificados; el respaldo incluye una comunidad DEMO previamente ficticia.

## Identificación y retirada

Todas las fichas tienen `testOnly: true`, `batchId: synthetic-enrichment-2026-10-16-v1` y `church.verification.source: synthetic_test_unverified`, con autorización falsa. `syntheticFields` enumera las rutas añadidas por este generador; `fieldProvenance` distingue esas rutas de los valores heredados no verificados. `containsSynthetic` indica si este generador añadió atributos a esa ficha, no certifica la realidad de los valores heredados.

Ejemplo: si una ficha no tenía denominación y se le asignó Bautista, esa ruta figura como `synthetic`. No se dedujo del nombre ni se consultó una fuente institucional. Es un maniquí para probar el recomendador, no un representante firmando una declaración :v.

Para retirar el lote de un almacén de pruebas, filtrar por su `batchId` y `testOnly`. No borrar registros originales por compartir nombre o referencia de Google Maps. Si se implementara una superposición sobre datos reales, retirar únicamente las rutas de `syntheticFields`, conservando el valor anterior y controlando versiones. Este lote no aplica esa superposición ni contiene una rutina de borrado.

## Uso técnico

Desde la raíz del proyecto:

```powershell
node Backend/scripts/build-test-dataset.js
```

El generador solo escribe estos archivos; no conecta con MongoDB. Valida cada objeto `church` con el esquema actual. Usa el respaldo histórico de 264 documentos y el inventario consolidado para reconstruir 343 documentos, de los cuales 336 quedan activos. No requiere consultar Google Maps ni YouVersion.

El formato externo `koinonia.test-fixture.v1` es específico de pruebas. No se debe pasar al importador de Google Maps, cuyo contrato exige procedencia Google Maps. Para cargarlo en un entorno de test se necesita un adaptador que conserve `testOnly`, `batchId` y `fieldProvenance` en una colección separada o manifiesto, asigne los autores de prueba y evite las identidades externas únicas del catálogo original. Ese adaptador no se implementa aquí.

El corpus RAG usa los identificadores de estas fichas y contiene avisos en cada documento. No se indexa automáticamente ni integra el futuro LLM/RAG. La evaluación con este lote permite comprobar filtros, diversidad de resultados, manejo de ausencias, recuperación y trazabilidad. La pertinencia real de las recomendaciones requiere fichas y fuentes reales validadas.

## Métodos de obtención considerados

- Google Maps: ETL histórico disponible; los datos recogidos no equivalen a validación institucional.
- Representantes de iglesias: vía prevista para completar y validar fichas.
- YouVersion: según el estado comunicado por el usuario, autorización de acceso pendiente. No se realizaron consultas a su API ni se enviaron invitaciones. La invitación automatizada es una estrategia pendiente.
