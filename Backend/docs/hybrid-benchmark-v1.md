# Evaluación reproducible híbrida v1 — 23/11/2026

## Alcance y reproducción

Ejecutar desde la raíz `node Backend/scripts/evaluate-hybrid-benchmark.cjs`. Requiere Ollama en 127.0.0.1:11435 con el mismo modelo/digest que expanded-vectors-v1.json y Backend/.env apuntando exactamente a koinonia_synthetic_test_v2_local. Una lectura de 20 fichas reutilizada por todo el lote; 45 fragmentos vigentes. Sin escrituras remotas. El script guarda expectativas antes de conectar y genera informes fechados. Límite global de procesamiento 480 segundos y solicitudes de embeddings de hasta 180 segundos; no inicia nuevas cuando no queda ese margen. MongoDB usa límites de conexión de 15 segundos y socket de 30. No es una prueba del navegador ni de HTTP público.

Fixture: Backend/scripts/fixtures/hybrid-benchmark-v1.json. 28 consultas, 20 de ajuste y 8 finales, con familias de equivalencia completas dentro de cada partición. Expectativas humanas escritas antes de ejecutar: condiciones canónicas, aclaración y etiquetas temáticas. No se ajustó el buscador entre particiones ni después de observarlas. Los casos finales ya se consumieron como evaluación: para otra decisión de generalización reservar casos nuevos.

## Ejecuciones

`node --check Backend/scripts/evaluate-hybrid-benchmark.cjs`: correcto.

Primer informe report-2026-11-23T04-43-18-209Z.json: interpretación ejecutada, cero recuperaciones por modelo local no disponible. No cuenta como evaluación de recuperación. Se inició Ollama mediante su CLI. Un intento posterior de `ollama serve` informó puerto ocupado; no se detuvo ni sustituyó el servidor. La aplicación de Ollama anunció una descarga automática de actualización, pero no se ejecutó el instalador.

Segundo informe report-2026-11-23T04-43-59-677Z.json: lote completo en 55,688 segundos, misma fixture y código de búsqueda. Inventario inicial coincide con modelo/digest de la muestra. Consulta /api/ps confirmó embeddinggemma en CPU, digest 85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1. Artefactos en outputs/search-diagnostics/benchmark-v1/. Contienen versiones hash y hash de la lectura. Una repetición futura puede cambiar si cambian las fichas; comparar hashes antes de comparar métricas. No se guarda copia privada de las fichas.

## Resultados separados

| Medida | Ajuste | Final |
|---|---:|---:|
| Interpretación de condiciones/aclaración correcta | 19/20 | 8/8 |
| Recuperaciones ejecutadas | 15 | 8 |
| Diferencias frente a filtros esperados | 0/15 | 0/8 |
| Etiqueta temática esperada en primeros 3 candidatos | 6/6 | 2/2 |
| Consultas sin evidencia con abstención de resultados principales | 2/2 | 2/2 |

Cinco consultas fueron bloqueadas: cuatro correctamente por contradicción/condición desconocida y una por sinonimia no reconocida. Diez de once pares preservan interpretación de condiciones y aclaración. Esa comparación no exige igualdad de intereses textuales ni de rankings.

Los filtros esperados se obtienen aplicando el validador existente a criterios fijados manualmente: comprueba consistencia entre interpretación y filtrado, no es una auditoría independiente del validador. Algunos conjuntos son vacíos; no se deduce cobertura del catálogo completo. La métrica temática compara etiquetas de los fragmentos con conceptos esperados; NO es utilidad humana, precisión semántica general ni demostración de verdad institucional. Son datos de prueba y una muestra pequeña.

## Fallos y prioridades

1. **Corroboración literal demasiado restrictiva.** En new-12 (apoyar vecinos necesitados), new-14 (practicar deportes) y new-26 (enseñar la Biblia), la recuperación encuentra una etiqueta pertinente en top 3 pero la verificación textual deja cero resultados principales. Sus pares literales muestran respectivamente 6, 5 y 7. Mejorar equivalencias semánticas controladas sin perder abstención. No basta cambiar un umbral de coseno.
2. **Sinonimia en requisitos.** new-20, sanitario adaptado, pide aclaración en lugar del criterio esperado de baño accesible. Mantener la abstención segura hasta introducir alias revisados y evaluar generalización.
3. **Cobertura y evaluación humana.** Ampliar datos y registrar juicios sobre los candidatos. No interpretar los 8/8 hits de etiqueta como satisfacción del usuario.
4. **Diagnóstico operativo.** Separar modelo ausente de digest cambiado en futuros mensajes; el código actual agrupa ambos. La prueba se recuperó iniciando el servicio local.

Tiempos de consultas individuales: primera recuperación 5543 ms; posteriores 63–115 ms. Excluyen la lectura inicial de MongoDB y no representan latencia HTTP ni concurrencia. El total incluye preparación/conexión. No se ejecutó compilación, despliegue, correo, commit o push. No se cambió la lógica de la aplicación para mejorar la cifra.
