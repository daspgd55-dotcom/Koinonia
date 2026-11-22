# Embeddings locales: primera evaluación

## Alcance

Laboratorio aislado sin MongoDB, dotenv, Express, correo ni datos reales. Utiliza el servidor Ollama existente en `http://127.0.0.1:11435` y el modelo local `embeddinggemma:latest`. No instala modelos ni cambia configuración persistente. No activa búsqueda semántica en la aplicación.

Archivos:

- `src/services/local-embeddings.lab.js`: cliente local, formatos de entrada, generación en lotes de cuatro, validación de vectores y similitud coseno.
- `scripts/fixtures/embedding-retrieval.cjs`: doce documentos y trece consultas sintéticas, con relevancia esperada fijada antes de ejecutar.
- `scripts/evaluate-embeddings-local.cjs`: siete controles locales, evaluación de recuperación y tres casos exploratorios.

Desde la raíz:

```powershell
node Backend/scripts/evaluate-embeddings-local.cjs
```

## Contrato técnico

Se usan los prefijos oficiales de recuperación de EmbeddingGemma:

- Consulta: `task: search result | query: {texto}`.
- Documento: `title: {título o none} | text: {texto}`.

Se solicita `truncate: false` para rechazar textos que excedan el contexto; no se pierde contenido silenciosamente. El laboratorio limita longitud de entrada, cantidad por lote, tamaño de respuesta y tiempo de cada petición. El límite de caracteres es adicional al límite real de tokens del modelo, no su equivalente. `num_gpu: 0` solicita CPU. Solo admite URL HTTP loopback sin credenciales ni redirecciones.

Cada vector debe contener exactamente 768 números finitos y tener norma no nula; se normaliza antes de calcular coseno. El resultado de similitud no es una probabilidad ni porcentaje de compatibilidad. No se fija un umbral de aceptación a partir de esta muestra.

Se comprueba el digest del modelo antes y después para detectar un cambio durante la evaluación. Los artefactos incluyen modelo, digest, dimensiones, versión del formato, hash del corpus, hash del texto de cada documento, vectores sintéticos, rankings y tiempos. Documentos y consultas usan el mismo modelo y espacio vectorial. Un cambio de modelo/formato exige regenerar los vectores; no mezclar índices.

Referencias: https://docs.ollama.com/api/embed y https://huggingface.co/google/embeddinggemma-300m (Prompt Instructions).

## Ejecución del 17 de noviembre de 2026

Comando ejecutado: `node Backend/scripts/evaluate-embeddings-local.cjs`, con acceso autorizado al servidor local. Terminó con código 0. No se ejecutaron compilación ni suite general.

- Modelo: `embeddinggemma:latest`, digest `85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1`.
- Controles: **7/7** (endpoint remoto, credenciales en URL, dimensiones incorrectas, valores no finitos, vector nulo, texto vacío y coseno de un vector idéntico).
- Corpus: **12 documentos** sintéticos con temas de comunidad y distractores negativos.
- Consultas principales: **10**. Documento relevante primero en **9/10**, dentro de los tres primeros en **10/10**; MRR **0,95**.
- Casos exploratorios: **3**, excluidos de esos indicadores porque dos no tienen documento relevante.

Artefactos en `outputs/embeddings-local/`:

- `report-2026-11-17T04-31-04-204Z.json`.
- `vectors-2026-11-17T04-31-04-204Z.json`.

El código 0 significa que pasaron los controles y que las diez consultas principales recuperaron el documento dentro del top 3. **No significa que todos los primeros resultados fueran correctos ni que el sistema esté listo para producción.**

### Límites observados

Al buscar escuela bíblica infantil, el texto que explícitamente dice que no la ofrece obtuvo 0,559 y quedó por delante del que sí la ofrece (0,533). La negación comparte vocabulario y tema: similitud no equivale a cumplimiento.

En accesibilidad, rampa/baño accesible obtuvo 0,618, pero acceso exclusivamente por escaleras quedó muy cerca (0,606). Por ello no usar el vector como prueba de accesibilidad; se requieren campos estructurados y filtros explícitos.

La consulta sobre lengua de señas, ausente del corpus, produjo un primer resultado con 0,269; una consulta de reparación de automóvil obtuvo 0,121. Ordenar por similitud siempre devuelve un vecino si existen documentos; aún no hay una política calibrada de «sin coincidencias».

La muestra es pequeña, sintética y con etiquetas definidas por quien preparó el laboratorio. Estos resultados no estiman precisión sobre iglesias reales ni sustituyen evaluación humana. No se ajustaron umbrales o documentos después de observar resultados.

## Siguiente fase

Actualización del 17/11/2026: se completó la prueba aislada en la copia remota autorizada. Véase `vector-search-lab.md` para el índice, comandos y resultados. No se conectó todavía con fichas reales ni con la aplicación.

Comprobar el despliegue local de MongoDB y soporte de Vector Search. Después preparar una colección derivada de textos públicos revisados, con `churchId`, procedencia, versión, hash, modelo/digest/formato y vector. Mantener sincronización y retirada cuando una ficha cambia o deja de ser pública. Reaplicar visibilidad y requisitos estructurados al recuperar resultados. Evaluar con fichas y consultas independientes antes de habilitar la interfaz. No se ha implementado ese índice, ingestión ni RAG generativo en esta fase.
