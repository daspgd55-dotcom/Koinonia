# Preparación de textos públicos para embeddings

Estado: laboratorio separado, sin rutas ni cambios en la búsqueda existente. Preparado el 18/11/2026 (UTC del artefacto; 18/11 en Chile).

## Contrato

`src/services/church-embedding-document.lab.js` transforma fichas mediante una lista explícita de campos. Reutiliza `publicChurch` para respetar la privacidad. Solo acepta fichas activas, publicadas/verificadas, sin fusión y fuera de la ficha editorial de ejemplo. No incluye contactos, dirección exacta, representantes, liderazgo, medios, auditoría ni información de importación en los textos.

Cada fragmento conserva `churchId`, campo de origen, parte, versión/fecha de la fuente, hash del texto y versión del transformador. Las descripciones extensas se dividen en bloques de 3000 caracteres; cada entrada completa se limita a 4000. Esta división es provisional: puede separar una oración. No se generan resúmenes ni se inventan hechos.

`planSync` calcula altas/cambios, documentos sin cambios y retiradas para una instantánea completa. Una retirada puede corresponder a un campo oculto, eliminación de texto, fusión, borrador o ficha inactiva. No ejecuta escrituras. No utilizar instantáneas parciales para calcular retiradas. La futura persistencia también deberá comparar digest/modelo/formato de embeddings, actualizar metadatos de procedencia aunque el texto no cambie y controlar ejecuciones concurrentes.

## Vista previa ejecutada

Desde la raíz:

```powershell
node Backend/scripts/prepare-church-embeddings.cjs --public-dns
node Backend/scripts/evaluate-church-embedding-document.cjs
```

El primer comando lee únicamente `churches` en `koinonia_synthetic_test_v2_local` y escribe un archivo local. Rechaza otras bases. No genera embeddings, crea índices ni escribe en MongoDB. DNS opcional 1.1.1.1 afecta solo al proceso.

Resultado: **1522 fichas leídas, 1381 con textos elegibles, 7068 fragmentos**. Archivo: `outputs/church-embeddings-local/plan-2026-11-18T05-13-40-909Z.json`. La primera ejecución restringida se interrumpió sin resultado; el reintento con permiso de red terminó con código 0.

Elegible significa que cumple visibilidad y contiene texto, no que sus datos sean auténticos o hayan sido revisados editorialmente. Se conserva `testData` y no se excluyen las fichas sintéticas de esta copia de laboratorio. La procedencia identifica el campo almacenado, no certifica su fuente original. Revisar los textos libres antes de su uso externo: un autor podría haber escrito información personal dentro de una descripción pública.

La evaluación sin red terminó con código 0: privacidad, exclusión de borradores/inactivos/fusionados/ejemplo, comparación idempotente, retirada de documentos/campos ocultos, actualización de un texto y fragmentación de una descripción extensa. No se ejecutaron pruebas generales ni compilación.

## Pendiente antes de activar

### Consultas evaluadas el 18/11/2026

Comando: `node Backend/scripts/evaluate-church-sample.cjs`. Ejecución terminada con código 0, usando exclusivamente Ollama local y los 15 vectores guardados. Los 12 casos y las etiquetas esperadas se fijaron antes de ejecutar en `scripts/fixtures/church-sample-queries.cjs`.

Ocho consultas con evidencia: **Hit@1 8/8, Hit@3 8/8, MRR 1** a nivel de fragmento. Incluyen cursos, deportes, liturgia, streaming, visitas a hogares, prédicas prácticas, bautismo de creyentes y recuperación multilingüe español→inglés. No equivalen a precisión sobre el catálogo completo: muestra pequeña, deliberada y consultas basadas en sus textos; no es una evaluación independiente de usuarios.

Cuatro casos exploratorios sin evidencia se excluyeron de esas métricas. Sus mejores cosenos fueron: accesibilidad 0,2967; horario inexistente 0,3659; taller automotriz 0,1295; negación de deportes 0,4913. La negación recuperó precisamente un fragmento sobre deportes. Un resultado válido sobre prédicas prácticas obtuvo 0,3513: hay solapamiento con casos sin evidencia. No establecer un umbral universal a partir de esta muestra ni interpretar la puntuación como probabilidad de cumplimiento.

Generar los embeddings de las consultas tomó 3893 ms, incluidos unos 3148 ms de carga inicial; no es latencia individual ni benchmark. Se verificaron hashes de textos y entradas, dimensiones y digest del modelo antes/después. Se guardó el ranking completo de los 15 fragmentos por consulta y los vectores de consulta para reproducción. El código 0 indica ejecución técnica completa, no resolución de los casos sin evidencia.

Resultados en `outputs/church-embeddings-local/`:

- `query-report-2026-11-18T05-28-45-499Z.json`: métricas, hashes, puntuaciones y ranking completo.
- `query-review-2026-11-18T05-28-45-499Z.md`: consultas y primeros tres textos recuperados.
- `query-vectors-2026-11-18T05-28-45-499Z.json`: vectores de las consultas.

No se consultó MongoDB, no se aplicaron filtros estructurados ni se usó Qwen. No se activó la aplicación ni se generaron respuestas para usuarios. El siguiente paso recomendado es validar requisitos y distinguir ausencia de evidencia de incumplimiento antes de presentar candidatos; ampliar después la evaluación con consultas independientes y más fichas.

### Muestra local completada el 18/11/2026

Se revisaron 15 fragmentos de 5 fichas: Corporacion Metodista Libre De Chile, Iglesia Corpus Domini, Iglesia Cristiana AR chile, Iglesia Bíblica Alma y Church of the Blessed Sacrament. La selección deliberada combina etiquetas, descripción en español y descripción en inglés; no es una muestra representativa ni certifica la veracidad de los datos. Se conservaron los textos y sus marcas `testData` sin alterarlos.

Hallazgo del plan completo: solo 4 fragmentos de descripción de iglesia (3 en inglés); predominan etiquetas y ubicación. La cobertura semántica dependerá de que las fichas tengan descripciones útiles. Los textos revisados no mostraron contactos ni nombres de personas. La revisión completa y cada texto están en `outputs/church-embeddings-local/sample-review.md`; el manifiesto está en `sample-reviewed.json`.

Comandos ejecutados desde la raíz:

```powershell
node Backend/scripts/embed-church-sample.cjs
node Backend/scripts/embed-church-sample.cjs --generate
```

El primer comando prepara el manifiesto y la revisión sin red. El segundo exige coincidencia con el manifiesto, hashes de texto válidos y el digest conocido de embeddinggemma antes de enviar textos exclusivamente a `127.0.0.1:11435`. No utiliza MongoDB. Un cambio en la instantánea requiere revisar la muestra otra vez antes de regenerar el manifiesto.

Dos intentos iniciales de generación fallaron sin producir vectores: Ollama no respondía. Se inició el ejecutable instalado con CPU, puerto 11435 y configuración limitada al proceso, en segundo plano. La generación posterior terminó con código 0: **15 vectores, 768 dimensiones, 5 iglesias, 5300 ms**, incluidos aproximadamente 3380 ms de carga inicial del modelo. Se validaron cantidad, dimensiones, valores finitos, norma no nula, hashes y estabilidad del digest. No se hizo una evaluación de recuperación ni de precisión y no se reconsultó la visibilidad actual de las fichas.

Archivos de resultado:

- `outputs/church-embeddings-local/sample-vectors-2026-11-18T05-21-16-806Z.json`: textos, procedencia, hashes de entrada y vectores.
- `outputs/church-embeddings-local/sample-report-2026-11-18T05-21-16-806Z.json`: modelo, controles y tiempos, sin vectores.

Ollama quedó disponible en segundo plano para continuar el laboratorio. No hubo descargas de modelos, escrituras remotas, cambios en iglesias, pruebas generales, compilación ni despliegue. La siguiente evaluación puede comparar consultas en español con estos fragmentos, incluyendo casos sin coincidencias, sin necesidad de escribir todavía en MongoDB.

Revisar y seleccionar una muestra pequeña de la vista previa; generar sus vectores con modelo/digest fijo; autorizar la colección derivada y su persistencia. Implementar sincronización, invalidación, comprobación de visibilidad vigente al recuperar y evaluación semántica independiente. La autorización de la fase anterior cubría una colección de documentos sintéticos; esta fase no amplía esas escrituras a las fichas derivadas.

Horarios, reuniones, accesibilidad y comunidades vinculadas quedan fuera de esta primera transformación. Requieren serialización fiel, filtros estructurados y su propia procedencia; no inferir disponibilidad a partir de similitud textual. No se ha activado búsqueda semántica ni RAG generativo.
