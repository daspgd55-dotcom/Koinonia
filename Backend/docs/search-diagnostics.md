# Diagnóstico por lotes y reproducción

## Analizar una exportación

Desde la raíz del repositorio:

```powershell
node Backend/scripts/analyze-search-feedback.cjs "C:/Users/david/Downloads/koinonia-evaluaciones-2026-11-18T16-46-32-952Z.json"
```

Valida el esquema, admite hasta 500 registros, deduplica por clave de evaluación (conserva la fecha más reciente) y agrupa consultas idénticas. No mezcla métodos ni iglesias en las valoraciones. Genera bajo `outputs/search-diagnostics/<hash>/`:

- `analysis.md`: revisión ordenada por cantidad de valoraciones negativas/insuficientes.
- `analysis.json`: señales con categoría, evidencia y grado de certeza.
- `cases.json`: consultas reproducibles y expectativas pendientes. Si existe, **no se sobrescribe**, preservando revisiones manuales.

Categorías: interpretación, requisitos, información faltante, recuperación y revisión manual. Una aclaración registrada o un requisito desconocido son hechos observados; una valoración negativa es solo una señal para investigar recuperación/interpretación. No se adivina una causa de presentación a partir del comentario. Los comentarios se conservan como texto del usuario, nunca se ejecutan como instrucciones. Los archivos generados pueden contener consultas y comentarios: revisar antes de compartir.

## Reproducir

Solo interpretación, sin red:

```powershell
node Backend/scripts/replay-search-cases.cjs outputs/search-diagnostics/6095e40ec3da/cases.json
```

Flujo completo contra el laboratorio local ya iniciado:

```powershell
node Backend/scripts/replay-search-cases.cjs outputs/search-diagnostics/6095e40ec3da/cases.json --live
```

Este modo usa exclusivamente `http://127.0.0.1:4600/query`, con redirecciones deshabilitadas, una consulta a la vez, límite de tiempo y reintentos acotados para 429. El servidor utiliza Ollama local y lectura de la copia autorizada; no hay escrituras remotas. Repite cada consulta una vez y recibe ambos métodos cuando corresponde. No presupone un resultado equivalente si cambiaron datos/modelo.

Guarda informes JSON/Markdown con consulta, resultado, error por caso, hashes de código, huella del conjunto y cambios respecto a interpretaciones registradas. En modo completo conserva también la respuesta del servidor, modelo/digest, huella de vectores y código cargado al arrancar. Si se editan servicios, reiniciar el laboratorio antes de comparar. Las nuevas evaluaciones exportadas de la pantalla incluyen esa procedencia.

Para comparar dos ejecuciones:

```powershell
node Backend/scripts/replay-search-cases.cjs outputs/search-diagnostics/6095e40ec3da/cases.json --compare outputs/search-diagnostics/runs/replay-2026-11-18T16-55-34-410Z.json
```

Con `--live` se pueden añadir también `--compare` y su ruta. Solo se declara mejora/regresión de interpretación si coinciden ID, consulta y expectativa revisada entre ejecuciones. Sin expectativa revisada, un cambio es **cambio sin evaluar**, no mejora. Las variaciones de fragmento, grupo o posición se conservan como observaciones; una valoración histórica no se transfiere automáticamente a un fragmento distinto. No se calcula precisión de ranking con candidatos que el usuario no valoró.

## Revisar expectativas

En cada caso de `cases.json`, `recordedInterpretations` conserva la salida antigua como referencia, **no como verdad**. Copiar una interpretación revisada a `expectation.value` y cambiar `status` a `reviewed` solo después de comprobarla. El valor incluye `kind`, `needsClarification`, `criteria` e `interests` (lista de textos). No se permite marcar `reviewed` sin valor válido. El contrato de criterios se valida antes de ejecutar.

Ejemplo independiente de expectativa para la consulta «Busco una iglesia en Ñuñoa o Macul.»:

```json
{"status":"reviewed","value":{"kind":"required","needsClarification":false,"criteria":[{"field":"location.commune","value":["Ñuñoa","Macul"],"polarity":"include"}],"interests":[]}}
```

Una valoración «Útil» sobre un resultado no revisa automáticamente todos los componentes de la interpretación. Los tres casos del archivo del usuario permanecen pendientes de revisión. Se provee aparte `scripts/fixtures/search-replay-regression.json` con cinco expectativas del contrato ya establecido (OR de comuna, negación, mezcla, requisito desconocido y contradicción), escritas por el desarrollador. No son juicios adicionales atribuidos al usuario.

Código de salida: 1 ante errores o expectativas revisadas incumplidas; 0 indica ejecución sin esos fallos, **no** que los pendientes hayan aprobado.

## Ejecuciones y hallazgos

Exportación analizada: **27 registros, 3 consultas, 17 útiles, 5 insuficientes y 5 no pertinentes**. Los diez juicios negativos/insuficientes corresponden a «Me interesa una comunidad que sirva a su barrio». Las otras dos consultas solo tienen valoraciones útiles entre los resultados evaluados; no implica que todos sus candidatos sean correctos.

Ejecuciones realizadas:

- Análisis del JSON: correcto; fuente original conservada.
- Reproducción offline de las 3 consultas: sin errores; expectativas pendientes.
- Regresiones del contrato: 5/5 correctas; segunda ejecución con `--compare`: 5 sin cambios, cero regresiones.
- Reproducción completa de las 3 consultas: sin errores, expectativas pendientes; interpretaciones y campos recuperados sin cambios respecto al exportado. Sin escrituras en MongoDB.

Informes iniciales: `outputs/search-diagnostics/6095e40ec3da/analysis.md`, `runs/replay-2026-11-18T16-55-34-410Z.json` (offline), `runs/replay-2026-11-18T16-55-55-949Z.json` (comparación de cinco regresiones) y `runs/replay-2026-11-18T16-56-33-479Z.json` (completo). Los casos de ejemplo no contienen todo el catálogo ni un ranking esperado completo; la automatización detecta cambios y concentra revisión, no reemplaza las etiquetas humanas.
