# Comparación por lotes: LFM3-1.7B

Comando desde la raíz: `node Backend/scripts/compare-lfm-intents.cjs`.

Ejecuta 16 consultas nuevas definidas en `scripts/fixtures/lfm-intent-cases.cjs`. Las expectativas se escribieron antes de ejecutar; se guardan con hash y no se ajustan durante el lote. Incluyen redacción interrogativa, error ortográfico, alternativas de comuna, condiciones AND, negaciones, intereses, mezcla de ambos canales, contradicción, horario no soportado, instrucciones incrustadas y tema ajeno. Son casos sintéticos de desarrollo, no consultas independientes de usuarios reales.

## Configuración y límites

- Modelo fijo `lfm3:1.7b`; digest leído antes y después del lote.
- Ollama local `127.0.0.1:11435`, sin redirecciones; CPU (`num_gpu:0`).
- `think:false`, contexto 4096, máximo 512 tokens de salida, temperatura 0,1, top_k 50, penalización de repetición 1,1, semilla 42.
- JSON Schema obligatorio, reutilizando el contrato, prompt y validación del ensayo Qwen.
- 45 segundos por petición de inferencia; presupuesto global de 300 segundos. El timeout de la última petición se acorta al tiempo restante. Sin reintentos que multipliquen el coste.
- Se persiste cada resultado. Los casos no iniciados por límite global se marcan `skipped_batch_deadline`; no se cuentan como fallos semánticos. Cancelar HTTP no constituye garantía de parada instantánea del motor Ollama.
- Verificación final del digest acotada al tiempo restante. Si no se puede comprobar o hay casos omitidos, el lote queda incompleto y devuelve código 1.

El tiempo máximo aplica a peticiones y planificación del lote; pequeñas operaciones de guardado local pueden añadir sobrecarga. Se registra latencia, tokens, motivo de finalización y cantidad de caracteres del canal thinking, sin mostrar su contenido. Las respuestas de texto del modelo se conservan para diagnóstico, nunca se ejecutan como instrucciones.

## Evaluación

Para requisitos se exige coincidencia del conjunto de condiciones canónicas; OR de comunas ignora el orden de alternativas. Para intereses se comprueba cobertura del fragmento esperado, no paráfrasis semántica arbitraria. En casos ambiguos o no soportados se exige abstención. Las reglas actuales y LFM se comparan sobre exactamente las mismas consultas.

Un JSON válido no es una respuesta correcta: puede perder requisitos, añadir intereses inexistentes o abstenerse sin necesidad. Rechazar una cita no literal tampoco demuestra que todo el contenido fuera incorrecto; se reporta el motivo de rechazo y la respuesta para revisión. La métrica representa propuestas completas utilizables bajo este contrato.

No hay conexión a MongoDB, generación de embeddings, cambios en fichas ni integración del modelo en el servidor del laboratorio. Las propuestas conservan `applied:false`. No se instalaron modelos adicionales. Los informes quedan bajo `outputs/search-diagnostics/lfm-shadow/`, en JSON y Markdown.

## Resultado del lote del 18/11/2026

Informe `outputs/search-diagnostics/lfm-shadow/comparison-2026-11-18T20-58-43-797Z.json` y revisión `.md`.

- Tiempo total: **300022 ms**; terminó por presupuesto global, código de salida 1 y estado `incomplete`.
- 16 casos planificados, **14 ejecutados**, 2 no iniciados. No se repitieron automáticamente fallos ni se ampliaron límites.
- Reglas: **11/14** interpretaciones correctas según expectativas. LFM: **0/14** propuestas completas utilizables bajo el contrato.
- Una propuesta pasó estructura/catálogo/citas, pero interpretó «con conferencias» como exclusión y además solicitó aclaración; no fue aplicada.
- Dos salidas agotaron el límite de tokens. La última petición ejecutada terminó por el tiempo restante del lote (aproximadamente 22,8 segundos), no porque alcanzara 45 segundos individuales.
- Los dos casos no iniciados son `lfm-new-15` (instrucción incrustada) y `lfm-new-16` (seguro automotriz); no se evaluó su comportamiento.
- No quedó tiempo para comprobar el digest al final: `modelStable:null`. Se conserva el digest inicial `b36a103fe2f8fbe9df2ceec88b9cfdf842dc04aaabe2b4677d1acf8e16570b5d`, pero **no se certifica estabilidad del modelo durante todo el lote**.

La comparación es preliminar e incompleta, aunque el límite temporal funcionó. Cero propuestas correctas no significa cero campos acertados: hubo condiciones reconocidas dentro de respuestas rechazadas. Tampoco permite concluir que toda la familia LFM sea incapaz; se probó un modelo, prompt, catálogo y presupuesto específicos. No se ajustó el prompt para mejorar retrospectivamente esta muestra.

Decisión: mantener LFM fuera de la búsqueda. Antes de probar modelos sucesivamente, conviene una evaluación de tarea más acotada (clasificar cláusulas como requisito/interés y polaridad, con normalización del catálogo a cargo del código), separando rechazo formal de error semántico. Esa variante no se implementó en este lote.
