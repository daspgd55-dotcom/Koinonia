# Evaluación del recorrido híbrido — 19/11/2026

## Ejecución

Se ejecutaron `node --check` para `Backend/scripts/evaluate-hybrid-flow.cjs`, `Backend/scripts/search-lab-ui/lab.js` y `Backend/scripts/serve-search-lab.cjs`: los tres finalizaron correctamente.

Se inició `node Backend/scripts/serve-search-lab.cjs --public-dns --expanded` y se ejecutó `node Backend/scripts/evaluate-hybrid-flow.cjs`. Nueve casos nuevos, expectativas persistidas antes de consultar; recorrido HTTP de separación, revisión explícita y búsqueda. Cinco búsquedas llegaron a embeddings y lectura de las fichas de la copia autorizada; cuatro quedaron bloqueadas durante revisión. Sin errores HTTP ni de servicios. No se recorrió el navegador ni se compiló React.

Muestra: 20 iglesias y 45 fragmentos, con datos de prueba. Ollama local y MongoDB `koinonia_synthetic_test_v2_local` en solo lectura. No hubo envíos, escrituras remotas, commit ni despliegue. El servidor local queda iniciado en http://127.0.0.1:4600/.

## Resultados

| Caso | Resultado observado |
| --- | --- |
| Ñuñoa o Providencia + deportes | OR conservado, seis candidatas dentro de esas comunas; primer resultado con etiqueta de deportes. |
| Pedro Aguirre Cerda + ayuda social | Una candidata, Gratitud nacional; fragmento con Ayuda social. |
| Providencia con retiros | Bloqueo incorrecto: la gramática no reconoce el modificador después de la comuna sin conjunción. |
| Ñuñoa sin campamentos | Mismo bloqueo incorrecto; este caso no llegó a evaluar exclusiones contra las fichas. |
| Estacionamiento para bicicletas | Pide aclaración; no descarta la condición desconocida. |
| Con ascensor y sin ascensor, en cláusulas separadas | Contradicción bloqueada. |
| Encuentros para practicar deportes | Primer resultado con Actividades deportivas. |
| Reparación de satélites | Devuelve 20 candidatos sin evidencia temática identificada. Primer coseno 0,331; no es una coincidencia útil demostrada. |
| Cerca del trabajo, corregido manualmente a Providencia + retiros | Primero pide aclaración; tras editar, recupera Augustinians Monastery con Retiros. |

Siete de nueve casos cumplieron las comprobaciones funcionales definidas. **Esto no equivale a 77,8 % de utilidad ni de precisión semántica**: el caso sin evidencia pasa el contrato de interpretación, pero falla como experiencia de búsqueda útil. Los cuatro casos ejecutados con etiqueta positiva esperada recuperaron esa etiqueta en primer lugar (4/4); indicador limitado, basado en coincidencia literal y una muestra pequeña, no una evaluación humana independiente. La comprobación de comunas no encontró resultados admitidos fuera del filtro en las búsquedas ejecutadas.

Tiempos HTTP de búsqueda (incluyen embedding, lectura y ranking): [7427, 1091, 999, 996, 1081] ms. Mediana 1081 ms; primera consulta 7427 ms, posteriores entre 996 y 1091 ms. No se midió por separado la carga del modelo ni se hizo prueba de carga concurrente.

## Diagnóstico y siguiente prioridad

1. Ampliar de forma general la composición de requisitos después de ubicaciones (`en ... con/sin ...`) y verificar equivalencias de orden y negaciones. Se conservaron los fallos de esta evaluación; no se ajustó el parser ni se repitió el lote para mejorar la cifra.
2. Diseñar abstención temática con más casos positivos y sin evidencia. El 0,331 del caso de satélites y el 0,199 de la búsqueda útil de retiros muestran por qué no basta un umbral único improvisado.
3. Completar un recorrido real de interfaz y exportación de evaluaciones. La revisión del contrato muestra que `buildIntent` no devuelve `kind`, mientras el importador de feedback lo exige: la exportación del nuevo flujo necesita una corrección de compatibilidad antes de usarla para recopilar valoraciones.

No se demuestra superioridad frente al ranking anterior: no se hizo evaluación comparativa ciega ni benchmark de rendimiento. Esta prueba recorre las rutas del servidor que usa la pantalla; no comprueba foco, teclado, móvil ni almacenamiento del navegador.

Artefacto completo: `outputs/search-diagnostics/hybrid/evaluation-2026-11-19T05-13-13-951Z.json`, con consultas, expectativas, revisiones, respuestas, procedencia y tiempos. Script reproducible: `Backend/scripts/evaluate-hybrid-flow.cjs`.


## Correcciones posteriores

- La gramática permite encadenar modificadores explícitos `con`, `sin` y `que tenga/no tenga…` después de un término reconocido, incluyendo comunas alternativas. Mantiene el rechazo de términos desconocidos, contradicciones y disyunciones de actividades no soportadas.
- `buildIntent` incluye `kind`. El importador infiere este campo para exportaciones anteriores que lo omitían, y conserva los metadatos de intención (consulta y revisión). No cambia los archivos históricos.
- `search-topic-evidence.lab.js` separa `accepted` de `exploratory` después de validar requisitos. Busca todos los términos significativos de cada interés en los cuerpos de fragmentos públicos vigentes de la misma iglesia, excluyendo la cabecera con nombre/ubicación. Normaliza acentos y plurales simples y elimina palabras genéricas; no usa un umbral coseno. Los candidatos sin apoyo suficiente quedan en un desplegable cerrado, sin promover los retenidos por incumplimiento de filtros. El reproductor reconoce el nuevo grupo.
- La UI muestra términos encontrados y sus fuentes. `textual_support` significa coincidencia textual, no cumplimiento ni certeza semántica. No maneja sinónimos, relaciones entre palabras o negaciones dentro del texto documental; puede omitir resultados útiles o encontrar palabras en contextos distintos. Un resultado sin apoyo significa abstención del sistema, no inexistencia del servicio. No se afirma una mejora de precisión general.

Verificación de las correcciones: `node Backend/scripts/evaluate-hybrid-corrections.cjs`, 15 comprobaciones offline correctas: cuatro composiciones de requisitos, polaridad negativa, tres abstenciones, importación de feedback nuevo y anterior, evidencia positiva, ausencia de evidencia, rechazo de palabras genéricas, interés compuesto incompleto y conservación de retenidos. Una primera ejecución falló por un problema de codificación introducido al editar; se corrigió y la repetición completó las 15. `node --check` del cliente y servidor terminó correctamente. No se repitió el lote remoto, no se compiló React ni se hizo recorrido visual. Para aplicar las rutas modificadas es necesario reiniciar el servidor del laboratorio y recargar la pantalla.


## Consistencia de OR y separación visual (19/11/2026)

Ejecutado `node Backend/scripts/evaluate-or-consistency.cjs`: una lectura de 20 fichas en la copia autorizada, reutilizada para todos los casos con los mismos fragmentos vigentes. No se generaron embeddings: se verificaron conjuntos, independientemente del orden. Resultado correcto:

| Consulta | Admitidas | Falta información | Incumplen |
| --- | ---: | ---: | ---: |
| Ñuñoa con retiros | 0 | 5 | 15 |
| Macul con retiros | 0 | 0 | 20 |
| Ñuñoa o Macul con retiros | 0 | 5 | 15 |
| Ñuñoa | 5 | 0 | 15 |
| Macul | 0 | 0 | 20 |
| Ñuñoa o Macul | 5 | 0 | 15 |

Se verificó igualdad exacta de IDs: admitidas y pendientes de OR coinciden con la unión de las consultas individuales. Se añadió una comprobación en memoria con seis fichas sintéticas, incluyendo coincidencias positivas y datos incompletos en ambas comunas: OR conserva dos admitidas y dos pendientes. Así la prueba no depende únicamente de conjuntos vacíos. No se reprodujo una pérdida por OR; esta evaluación no certifica qué ocurrió en una ejecución anterior no exportada.

Evidencia: `outputs/search-diagnostics/or-consistency/comparison-2026-11-19T05-36-48-237Z.json`, con hash de la lectura, IDs y conteos.

La pantalla divide `held` por estado: `unknown` en «Falta información para confirmar», `not_satisfied` en «No cumplen alguna condición» y otros estados en «No evaluables». Si una ficha incumple una condición y además tiene datos faltantes, permanece en incumplimiento. Cada sección tiene contador; pendientes se abre si no hay admitidos, incumplimiento permanece plegado. Los candidatos sin apoyo temático conservan su sección aparte. Feedback conserva `group: held` para compatibilidad y añade `displayGroup` para identificar la sección visible. No se borraron evaluaciones anteriores.

`node --check Backend/scripts/search-lab-ui/lab.js` correcto. No se ejecutó compilación ni recorrido visual; los cambios estáticos se aplican recargando la página, sin reiniciar el servidor. Sin escrituras en MongoDB, envíos, commit ni despliegue.
