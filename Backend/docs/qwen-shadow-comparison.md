# Qwen como intérprete paralelo

`src/services/qwen-intent-shadow.lab.js` propone requisitos, alternativas de comuna e intereses mediante Ollama local. No se importa desde rutas públicas, el servidor del laboratorio ni los filtros de búsqueda. Toda propuesta válida conserva `applied:false` y `requiresReview:true`.

Modelo fijo `qwen2.5:1.5b`, instalado previamente, puerto local 11435, CPU, contexto 4096, temperatura 0, semilla 42, salida máxima 512 tokens y timeout 90 segundos. No se descarga otro modelo ni se activa Qwen3, que presentó problemas en pruebas anteriores. No se envían fichas, contactos ni evaluaciones privadas al modelo: solo la consulta sintética y el catálogo permitido.

Contrato estricto: requisitos con campo, valor, polaridad y cita literal de la consulta; intereses y partes no resueltas con citas literales. Valida forma, límites, campos/valores del catálogo, contradicciones y correspondencia de las citas. Rechaza respuestas truncadas. Estas comprobaciones **no prueban que todos los requisitos hayan sido extraídos**: una propuesta puede respetar el contrato y omitir una condición. No utilizarla automáticamente como filtro.

## Ejecución

Desde la raíz:

```powershell
# Referencia con JSON libre validado después.
node Backend/scripts/compare-qwen-intents.cjs

# Mismos casos y expectativas, generación con JSON Schema obligatorio.
node Backend/scripts/compare-qwen-intents.cjs --structured
```

Se comparan 12 casos seleccionados antes de ejecutar desde el conjunto de desarrollo de 40: condiciones claras, formulaciones interrogativas, error ortográfico, sinónimo, negación no soportada, intereses, mezcla, horario e intento de cambiar instrucciones. No son todos los casos ni un conjunto independiente de usuarios. La gramática ya conocía el conjunto; esto favorece a las reglas y no estima precisión general de Qwen.

Se guardan resultados parciales tras cada caso, respuestas crudas acotadas, rechazos, métricas, digest del modelo antes/después, hashes del código y selección. El código de salida 0 indica evaluación completa, no que el modelo haya aprobado. Los desacuerdos y regresiones son comparativos contra las etiquetas de desarrollo; no afectaron al buscador.

La corrección de intereses se mide por cobertura del texto esperado, con normalización de acentos y mayúsculas. No es una evaluación semántica humana independiente. En casos de aclaración, se evalúa abstención. El contrato puede aceptar una propuesta que la evaluación de expectativas considera incorrecta.

## Controles aislados

Se comprobaron 7 controles sin red: propuesta de OR válida y no aplicada; rechazo de claves adicionales, valor fuera del catálogo, evidencia inventada, campo no permitido, JSON mal formado y salida vacía. Todos pasaron.

La primera ejecución con JSON libre produjo cero propuestas utilizables en 12 casos: las reglas resolvieron 9/12. Hubo omisiones de campos, polaridades nulas y respuestas truncadas. Se preservó ese informe y se repitió con JSON Schema sin cambiar casos, expectativas ni prompt. No se modificó la búsqueda pública ni la pantalla experimental.

## Resultados finales del 18/11/2026

| Método | Casos correctos según expectativas | Propuestas que pasaron contrato |
| --- | ---: | ---: |
| Reglas actuales | 9/12 | No aplica |
| Qwen JSON libre | 0/12 | 0/12 |
| Qwen JSON Schema | 0/12 | 2/12 |

En la segunda ejecución el digest permaneció estable. Tiempo por consulta: 2,763–22,358 segundos, media 7,396 segundos; medición de este equipo y muestra, no benchmark general. No hubo ganancias frente a reglas en este contrato y configuración. «0 correctas» significa cero propuestas completas aceptadas que satisfacen las expectativas: no significa que todos los campos o todas las ideas de cada respuesta sean incorrectos.

Los dos resultados que pasaron forma/catálogo/citas siguieron siendo incorrectos: uno omitió Macul de «¿Hay iglesias con voluntariado en Macul?»; otro añadió rampa y lengua de señas a una petición de ascensor y ambiente acogedor, además de perder el interés descriptivo. Esto confirma que las citas y el JSON Schema por sí solos no validan el significado.

Informes JSON y Markdown en `outputs/search-diagnostics/qwen-shadow/`:

- `comparison-2026-11-18T20-11-14-164Z.json` / `.md`: JSON libre.
- `comparison-2026-11-18T20-12-53-867Z.json` / `.md`: JSON Schema.

Decisión: mantener Qwen exclusivamente en comparación. No recomendar activar este modelo pequeño como extractor de requisitos en la aplicación. Una evaluación futura de otro modelo o tarea más acotada debe conservar estos fallos como regresiones y usar también un conjunto independiente. Esta conclusión se limita a `qwen2.5:1.5b`, prompt, catálogo y configuración probados; no es una conclusión sobre toda la familia Qwen.
