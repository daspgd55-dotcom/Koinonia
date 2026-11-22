# Requisitos e intereses: evaluación y contrato del laboratorio

## Actualización: separación automática (18/11/2026)

`src/services/free-search-intent.lab.js` incorpora `interpretFreeText(query)`. Divide cláusulas señaladas por punto y coma, fin de oración, o conectores ante una nueva petición explícita. Primero intenta interpretar requisitos con la gramática existente. Si no encaja, solo clasifica como interés las fórmulas explícitas «me interesa», «me gustaría», «me atrae», «tengo curiosidad por», «quisiera conocer/explorar» y «quiero conocer historias de». No convierte automáticamente cualquier texto no reconocido en interés.

Conserva consulta, requisitos, intereses y evidencia con posiciones `start`/`end` sobre el texto original. Los intereses siguen marcados `retrieval_only` y `provesCompliance:false`. Reconoce orden requisito→interés o interés→requisito, varios intereses y varios requisitos. El texto completo sigue siendo `retrievalText`; no se llama al modelo de embeddings.

Una cláusula desconocida, una contradicción o un interés con señales de obligación/negación queda sin resolver y bloquea aceptación. Un criterio repetido se deduplica. Los requisitos desconocidos no se eliminan aunque la parte descriptiva sea interpretable. Las guardas son conservadoras y limitadas: no constituyen comprensión general del español ni una protección universal ante todas las paráfrasis posibles. Las conjunciones ambiguas y condiciones dentro de intereses deben aclararse.

`assessFreeTextCandidates(candidates, churches, query)` en `search-intent.lab.js` interpreta y aplica la validación sin aceptar planes externos. Usa el mismo filtro de requisitos y visibilidad que el canal explícito. Solo intereses conserva estado `not_required`, sin afirmar pertinencia o cumplimiento. No cambia endpoints ni interfaz pública, no conecta a Qwen ni consulta MongoDB.

Ejemplo:

```text
Necesito una iglesia con ascensor; me gustaría un ambiente acogedor.
Requisito: accessibilityDetails.elevator = yes
Interés: un ambiente acogedor
```

La puntuación descriptiva no permite aceptar una iglesia sin evidencia del ascensor. «Necesito una iglesia que abra mañana; me interesa su historia» sigue bloqueada porque el requisito de horario no está soportado.

### Comprobaciones ejecutadas

- `node Backend/scripts/evaluate-free-search-intents.cjs`: código 0, **25 controles** de segmentación, posiciones de evidencia y barrera de candidatos. En los 40 casos previos: **11/15 requisitos completos**, **8/8 descriptivos**, **8/8 mixtos**; 4 requisitos, 8 aclaraciones y el caso ajeno al dominio quedan sin resolver. Cero extracciones incompatibles con las expectativas observadas. La categoría ajena no se identifica específicamente: se abstiene.
- `node Backend/scripts/evaluate-search-intents.cjs`: mantiene la referencia anterior, 9 controles de canales correctos.
- `node Backend/scripts/evaluate-search-requirements.cjs`: 20/20.
- `node Backend/scripts/evaluate-requirement-interpretation.cjs`: 37 controles correctos.

Informe: `outputs/church-embeddings-local/free-intent-report-2026-11-18T05-52-12-466Z.json`; revisión legible: `free-intent-review-2026-11-18T05-52-12-466Z.md`. Las expectativas se conservaron; ahora este conjunto es de desarrollo porque la implementación se hizo conociéndolo. La coincidencia de intereses se comprueba por cobertura del fragmento esperado, no por comprensión semántica independiente. Pendiente un conjunto nuevo recogido de usuarios, recuperación descriptiva y una política de ausencia de evidencia. No hubo red, escrituras remotas, compilación ni despliegue.

El resto del documento describe la línea de base previa y la separación explícita; la limitación anterior «separación automática pendiente» queda reemplazada por esta implementación experimental limitada.

## Muestra nueva

`scripts/fixtures/search-intent-evaluation.cjs` define 40 consultas y sus expectativas antes de la ejecución: 15 con requisitos, 8 que requieren aclaración, 8 descriptivas, 8 mixtas y 1 ajena al dominio. Incluye errores ortográficos, formulaciones interrogativas, sinónimos, negaciones, contradicciones y cláusulas no soportadas. Las etiquetas definen requisitos canónicos e intereses esperados, y motivos de aclaración cuando corresponde.

Son casos sintéticos escritos con conocimiento del proyecto, no preguntas recogidas de personas ni evaluación ciega. Se congelaron antes de ejecutar; no se modificó el intérprete para mejorar su resultado. El informe registra hashes del conjunto y del intérprete. Tras usar este conjunto para futuras mejoras debe considerarse conjunto de desarrollo, y emplear otro para medir generalización.

## Dos canales implementados

`src/services/search-intent.lab.js` incorpora `buildIntent({requirementsText, interestText})` y `assessCandidates(candidates, churches, input)`:

- **Requisitos:** condiciones obligatorias. Pasan por la interpretación y la validación existentes. Un requisito desconocido pide aclaración; nunca se transforma automáticamente en interés.
- **Intereses descriptivos:** texto proporcionado explícitamente en un canal separado, para recuperar descripciones cercanas al tema. No demuestra cumplimiento, no cambia permisos ni compensa requisitos incumplidos. El canal no promete detectar requisitos que alguien escriba por error como intereses.
- **Mixtas:** los dos canales se conservan separados. `retrievalText` prepara el texto para la futura recuperación; aún no se envía a embeddings ni se combina con un endpoint.
- **Solo intereses:** los candidatos visibles se pueden conservar con estado `not_required`, nunca `satisfied`. Significa «no hay requisitos que comprobar», no que el resultado responda al interés. La pertinencia y la abstención por ausencia de evidencia siguen pendientes.

Ejemplo: requisitos «Necesito una iglesia en Macul» e interés «historias de esperanza». Macul debe estar respaldado por la ficha; la esperanza orienta la similitud textual. Una iglesia fuera de Macul no pasa por tener una descripción muy parecida.

El llamador debe proporcionar fichas actuales y candidatos previamente autorizados. El servicio vuelve a comprobar elegibilidad, retiene fichas ausentes y no devuelve sus datos internos. No implementa sincronización, búsqueda vectorial, umbral de pertinencia ni interfaz. Las consultas de texto único continúan usando el intérprete anterior: la separación automática de lenguaje libre **sigue pendiente**; no se presenta el canal explícito como si la resolviera.

## Ejecución del 18/11/2026

`node Backend/scripts/evaluate-search-intents.cjs`, código 0. Sin red, MongoDB, Ollama, compilación ni cambios externos.

| Categoría | Casos | Resultado del intérprete anterior |
| --- | ---: | --- |
| Requisitos | 15 | 11 exactos; 4 abstenciones |
| Requieren aclaración | 8 | 8 abstenciones |
| Descriptivas | 8 | 8 sin resolver; no extrae intereses |
| Mixtas | 8 | 8 sin resolver; no separa canales |
| Ajena al dominio | 1 | Se abstiene, pero no identifica expresamente que sea ajena |

No se observaron extracciones incompatibles con las expectativas en este conjunto. Esto no demuestra ausencia de errores fuera de la muestra. No se ofrece una cifra global de precisión que cuente las abstenciones descriptivas como aciertos. Los cuatro requisitos no resueltos son una pregunta «¿Hay iglesias…?», el error «iglecia», «Quisiera una congregación…» y el sinónimo «baño adaptado». No se ajustaron esas reglas tras observarlos.

También pasaron **9 controles** del contrato de canales: entrada vacía, campos ajenos, separación de requisito e interés, negación no anulada por interés, requisito desconocido no descartado, solo intereses sin afirmar cumplimiento, fichas inactivas/borrador y datos faltantes. Estos controles no evalúan separación automática.

Los artefactos `outputs/church-embeddings-local/intent-baseline-*.json` conservan resultados y hashes, y `intent-cases-*.md` muestran cada consulta con su expectativa y resultado. Se corrigió el resumen para no contar una mera abstención como identificación del caso ajeno al dominio; esa corrección de medición no modifica el intérprete ni las etiquetas.

## Próxima decisión

El cuello de botella ya no es ejecutar embeddings: es extraer una intención completa sin perder condiciones. La siguiente fase puede comparar un extractor mixto con esta referencia y nuevos casos independientes, manteniendo validación estructural y aclaración ante ambigüedad. No habilitar aún el flujo público ni afirmar que «acogedor» o «tranquilo» son propiedades verificadas.
