# Laboratorio local de interpretación semántica

Primera fase experimental, sin rutas públicas ni conexión con la búsqueda. Usa Ollama en `http://127.0.0.1:11435` y `qwen2.5:1.5b`. No inicia Ollama ni cambia sus variables: el servidor debe estar abierto con la configuración CPU usada en las pruebas. No requiere MongoDB, credenciales, correo ni nuevas dependencias.

## Ejecución

Desde la raíz del repositorio:

```powershell
node Backend/scripts/evaluate-semantic-local.cjs
```

El script vigente ejecuta siete controles de validación y doce consultas sintéticas secuenciales. Puede tardar varios minutos en CPU; cada petición tiene un máximo de 180 segundos. Devuelve código 1 si algún caso falla. Escribe informes en `outputs/semantic-local/`, con fecha en el nombre para conservar evaluaciones sucesivas. La primera evaluación anterior a ese cambio está en `evaluation.json`.

## Contrato inicial (evaluaciones v1)

`src/services/semantic-interpretation.lab.js` admite comuna, denominaciones, actividades y grupos etarios. Cada criterio incluye campo, valor canónico, polaridad include/exclude y evidencia literal del mensaje. `unresolved` conserva citas de peticiones ambiguas o no soportadas. No infiere ni aplica modos required/preferred, geolocalización, permisos ni ranking.

El CLI lee el catálogo existente de `Frontend/src/catalog.js` para evitar inventar etiquetas diferentes (Jóvenes es un grupo etario, no una actividad). Esta dependencia entre carpetas es solo del laboratorio; no se añade al arranque del backend ni se presupone disponible en un despliegue separado. Una integración futura necesitará un contrato versionado y distribuible para los catálogos.

El servidor local recibe un JSON Schema. El backend vuelve a validar: estructura estricta, catálogo correspondiente al campo, citas presentes en la consulta, ausencia de duplicados o contradicciones sobre el mismo valor. Rechaza salidas truncadas y limita la respuesta a 64 KiB. La URL queda limitada a HTTP loopback sin credenciales ni redirecciones; el modelo permitido es exclusivamente el local seleccionado, sin variantes cloud.

Toda propuesta devuelve `requiresReview: true` y `applied: false`. Una cita existente no demuestra por sí sola que el modelo interpretó bien la intención o negación. Las exclusiones todavía no se traducen a consultas MongoDB. Los casos sintéticos son diagnósticos, no una certificación de resistencia a inyección ni una medición representativa de calidad.

## Evaluación realizada el 17 de noviembre de 2026

- Primera ejecución restringida: 4 controles de validación aprobados; las 6 peticiones fallaron por conexión (`fetch failed`). No evalúa calidad del modelo.
- Ejecución autorizada contra Ollama: 4/4 controles aprobados; 1/6 consultas aprobada (sin preferencia de denominación). Cuatro consultas fueron rechazadas por evidencia/valor inválido y una por salida incompleta. Informe `outputs/semantic-local/evaluation.json`.
- Se restringió el esquema para vincular cada campo a su propio catálogo y se añadió conservación de salida rechazada de las consultas sintéticas para diagnóstico. La repetición genera un informe con fecha.
- Segunda evaluación con esquema restringido: nuevamente 4/4 controles y 1/6 consultas aprobadas. Informe `outputs/semantic-local/evaluation-2026-11-17T03-41-12-351Z.json`. El modelo copió instrucciones del sistema como evidencia en el caso jóvenes, omitió Ñuñoa en la negación e inventó comuna/denominación al solicitar una iglesia tranquila o cercana a casa. La validación rechazó esas propuestas. La consulta de instrucciones maliciosas agotó el máximo de salida. La consulta aceptada tardó 5,1 segundos y produjo 79 tokens; no representa una media ni un benchmark del equipo.

Conclusión: el modelo/configuración actual no alcanza calidad suficiente para conectar este extractor a la búsqueda. El siguiente trabajo es simplificar la extracción y contrastar instrucciones/modelos con consultas nuevas, sin debilitar las validaciones para mejorar artificialmente la puntuación. El caso de ausencia de preferencia admite un `unresolved` adicional: su aprobación significa que coincide la lista de filtros, no que toda la salida sea perfecta.

## Simplificación y reevaluación (implementación vigente, v4)

El código localiza menciones literales de comunas, denominaciones, actividades y grupos etarios del catálogo, normalizando mayúsculas y tildes y respetando límites de palabra. Prioriza etiquetas largas: Adultos mayores no genera además Adultos. **No es recuperación semántica**: los sinónimos sin coincidencia literal siguen pendientes.

Qwen ya no escribe valores ni citas: solo clasifica candidatos identificados como c0, c1... en `include`, `exclude`, `uncertain` o `not_requested`. El servidor verifica un objeto estricto con exactamente las claves esperadas, valores enumerados y el catálogo original. Se envía `format: json` a Ollama, conservando JSON Schema/Zod como validación local. Una decisión estructuralmente válida puede seguir siendo semánticamente errónea: nada se aplica automáticamente.

Si no hay candidatos, se devuelve la consulta completa como no resuelta **sin llamar al modelo**. Esto evita inventar ubicación o denominación, pero no debe contarse como un acierto de Qwen. Las propuestas incluyen candidatos, decisiones y métricas `modelCalled`; mantienen `requiresReview: true` y `applied: false`.

### Ejecuciones realizadas

Se ejecutó `node Backend/scripts/evaluate-semantic-local.cjs` tres veces contra el servidor local, con las seis consultas originales y seis adicionales. Las expectativas se fijaron antes de las ejecuciones. Los casos nuevos son diagnósticos ya observados después de esta iteración, no un conjunto de evaluación reservado para el futuro.

| Versión | Controles locales | Consultas aprobadas | Informe en outputs/semantic-local |
|---|---|---|---|
| v2, copiar fragmentos | 4/4 | 6/12 con criterio inicial de no resuelto | evaluation-2026-11-17T03-50-01-897Z.json |
| v3, clasificar candidatos con esquema en Ollama | 7/7 | 4/12 | evaluation-2026-11-17T03-51-27-121Z.json |
| v4, clasificar candidatos con JSON simple | 7/7 | 7/12 | evaluation-2026-11-17T03-52-31-175Z.json |

En v2 bastaba cualquier cita no resuelta: incluso «iglesia» podía pasar ante «iglesia tranquila». Se endureció esa evaluación en v3/v4 para exigir conservar la consulta completa cuando se espera aclaración. No comparar las cifras como si fueran un benchmark con idénticas condiciones.

En v4, cuatro de las siete consultas aprobadas se resolvieron por abstención del código sin llamar al modelo. Qwen acertó 3 de las 8 consultas que recibió: ausencia de preferencia, actividad con grupo etario y exclusión de denominación en Macul. Falló 5: en dos devolvió valores en vez de decisiones (rechazadas); confundió Nueva Providencia con Providencia, resolvió incorrectamente una contradicción y aceptó una preferencia introducida por una instrucción maliciosa. Los controles locales adicionales comprueban límites de palabras/etiquetas largas, decisión inválida y decisión omitida.

Las tres ejecuciones finalizaron con código 1 por esos fallos, no por caída del script. No se ejecutó compilación, suite general, MongoDB ni correo. El siguiente paso requiere comparar un modelo/configuración alternativo o clasificación por candidato con nuevos casos independientes: la versión actual es una herramienta de diagnóstico, no un intérprete apto para producción. No añadir excepciones para ocultar los errores observados ni rebajar las validaciones.

No se ejecutó la suite general ni compilación. No se conectó MongoDB, no hubo envíos, instalación de modelos, publicación ni cambios en los endpoints de recomendaciones. Embeddings, índice vectorial, RAG, interfaz y activación semántica siguen pendientes. Antes de integrar hace falta evaluar precisión con más consultas independientes, tiempo de respuesta, fallos y confirmación del usuario.
