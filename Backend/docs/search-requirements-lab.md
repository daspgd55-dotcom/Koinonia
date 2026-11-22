# Validación de requisitos y negaciones — laboratorio

## Alternativas de comuna

Actualización: «Busco una iglesia en Ñuñoa o Macul» produce un único requisito `location.commune`, `value: ['Ñuñoa','Macul']`, `polarity: 'include'`. Basta pertenecer a una de las comunas. La alternativa se limita a ese requisito; «en Ñuñoa o Macul y con rampa» exige además rampa. También admite «o en Macul» y hasta seis comunas conocidas, sin duplicarlas. Si la comuna de la ficha falta, el resultado sigue siendo desconocido.

El contrato admite listas de valores únicamente para inclusión de comuna. No habilita OR arbitrario entre actividades, accesibilidad u otras cláusulas. Alternativas desconocidas, negadas o expresiones fuera de la gramática se abstienen. La interfaz presenta las alternativas con «o», no como dos requisitos AND. Las descripciones históricas de rechazo general de OR quedan acotadas por esta excepción.

Verificación: comprobaciones aisladas de Ñuñoa/Macul aceptadas, Providencia rechazada, comuna ausente desconocida, combinación AND con rampa, frase mixta con interés y alternativas/campos inválidos. Regresiones: `evaluate-search-requirements.cjs` 20/20 y `evaluate-requirement-interpretation.cjs` 37 controles correctos. Servidor local reiniciado con muestra ampliada. Sin escrituras en MongoDB ni cambios públicos.

## Actualización: interpretación v2 (18/11/2026)

`src/services/requirement-interpretation.lab.js` amplía la gramática y `parseQuery` delega en ella antes de validar el contrato. Las descripciones de cobertura de la primera versión que aparecen más abajo se conservan como historial; la cobertura vigente es la descrita aquí.

Se admiten peticiones con busco/necesito/quiero, iglesia/comunidad, participar en actividades de una iglesia, y ministerios explícitos. Reconoce un vocabulario controlado de actividades, doctrina, ministerios con prefijo «ministerio de», accesibilidad y las comunas del catálogo actual del frontend. Se normalizan acentos y mayúsculas. La copia del vocabulario es específica del laboratorio: habrá que centralizarla antes de integrar para evitar divergencias con el catálogo.

Admite condiciones AND, comas, artículos, `con`, `sin` y `que no tenga/realice/ofrezca/organice/practique`. La negación se mantiene en la enumeración hasta un modificador explícito: «sin campamentos y retiros» excluye ambos; «sin campamentos y con retiros» cambia la polaridad. La ubicación «en Providencia» no hereda una negación de actividades anterior. Los nombres completos se reconocen antes que los conectores, incluyendo «Separación de Iglesia y Estado».

Toda la frase debe quedar cubierta. Cualquier resto desconocido, disyunción, cláusula adversativa, preferencia, doble negación o contradicción produce abstención completa, sin criterios aplicables. Las repeticiones idénticas se deduplican. No se convierten frases como «cerca de Ñuñoa» en la comuna Ñuñoa ni «sin deportes» en ausencia probada a partir de una lista vacía. No hay llamadas a Qwen ni descarga de modelos.

### Evaluación de la ampliación

- `node Backend/scripts/evaluate-requirement-interpretation.cjs`: **37 controles correctos** (25 casos adicionales de interpretación/abstención y 12 consultas anteriores). La primera ejecución detectó que «practique el bautismo» no se interpretaba; se añadió manejo de artículos y se repitió correctamente.
- `node Backend/scripts/evaluate-search-requirements.cjs`: **20/20**, regresión del contrato y evidencia.
- `node Backend/scripts/evaluate-sample-requirements.cjs --public-dns`: código 0, cinco fichas actuales leídas, cero fragmentos obsoletos; sin escrituras remotas.

La cobertura sobre las 12 consultas anteriores pasa de **2 a 7**. Cinco nuevas consultas resueltas automáticamente (cursos y conferencias, deportes, liturgia y eucaristía, streaming en Ñuñoa, bautismo de creyentes) coinciden con la selección obtenida anteriormente al introducir criterios manuales. La negación de deportes sigue sin aceptar ninguna ficha y accesibilidad queda sin información. Las cinco consultas restantes (hogares, prédicas prácticas, descripción histórica, horario, taller automotriz) se abstienen. Estas reglas se desarrollaron conociendo la muestra: la mejora no es una estimación independiente de precisión lingüística.

Artefactos: `outputs/church-embeddings-local/interpretation-v2-report.json`, `requirements-report-2026-11-18T05-40-49-307Z.json` y `requirements-review-2026-11-18T05-40-49-307Z.md`. El ranking original se reutiliza, sin regenerar embeddings. La función sigue siendo experimental, sin ruta pública ni cambios en la interfaz. Pendiente: evaluación con frases de usuarios independientes, vocabulario compartido y tratamiento separado de intenciones descriptivas que no constituyen requisitos estructurados.

Implementación: `src/services/search-requirements.lab.js`. No registra rutas, modifica recomendaciones ni conecta con MongoDB/Ollama. Es una barrera entre candidatos semánticos y resultados que pueden declararse compatibles.

## Contrato y uso

`validate({criteria, unresolved})` acepta como máximo 12 criterios obligatorios unidos por AND. Cada criterio contiene `field`, `value` y `polarity` (`include` / `exclude`). Se rechazan campos desconocidos, propiedades adicionales y criterios duplicados o de polaridad contradictoria para el mismo valor. No hay criterios opcionales, OR ni puntuaciones de cumplimiento.

Campos admitidos: actividades, ministerios, grupos destinatarios, características doctrinales, comuna y los cuatro indicadores de accesibilidad desglosada. Estos últimos solo admiten valor `yes`; `exclude` pide ausencia explícita. Un requisito desconocido debe ir a `unresolved`, no descartarse. Este contrato no prueba por sí solo que una extracción del lenguaje sea correcta.

`parseQuery(text)` reconoce exclusivamente frases completas sobre actividades deportivas, incluidas “sin” y “que no realice/tenga/ofrezca”, y peticiones positivas de rampa, baño accesible, ascensor e intérprete de lengua de señas, combinadas con “y”. Cualquier otra frase queda sin resolver. No interpreta automáticamente toda la lista anterior, ni horarios, preferencias, doble negación, OR, recomendaciones médicas o afirmaciones subjetivas. No usa Qwen, cuya extracción todavía requiere revisión. Por ejemplo “No quiero una iglesia sin actividades deportivas” pide aclaración, no invierte una negación por intuición.

`evaluateChurch(church, request)` aplica elegibilidad y serialización pública existentes. Devuelve requisitos con evidencia del campo, valor, fecha y versión cuando está disponible:

| Estado | Significado |
| --- | --- |
| `satisfied` | Todos los requisitos tienen evidencia explícita compatible. |
| `not_satisfied` | Hay al menos un requisito contradicho por datos explícitos. |
| `unknown` | Falta evidencia, hay información parcial o no hay criterios. |
| `needs_clarification` | Queda alguna parte de la consulta sin resolver. |
| `ineligible` | Ficha inactiva, borrador, fusionada o ejemplo excluido. |

Las listas no se consideran exhaustivas: que falte “Actividades deportivas” no demuestra que no haya deportes. Si la etiqueta existe, cumple la petición positiva y contradice la negativa. En accesibilidad `yes` y `no` son evidencia; `partial`, `unknown` y campos ocultos no prueban cumplimiento completo. La comuna es un valor único: una comuna distinta contradice la solicitada. No se infieren hechos a partir de nombres, textos libres ni puntuaciones vectoriales.

`filterCandidates(candidates, churches, request)` conserva el orden recibido, agrupa por `churchId` (primera aparición) y separa `accepted` de `held`. Solo admite `satisfied`; mantiene motivos de retención. Una ficha sin fuente queda retenida. El llamador debe recuperar fichas actuales y mantener visibilidad vigente: esta función no consulta la base ni garantiza frescura de una instantánea. No presentar candidatos retenidos como compatibles.

## Verificación ejecutada

El 18/11/2026 se ejecutó `node Backend/scripts/evaluate-search-requirements.cjs`, con resultado **20/20**, código 0. Datos sintéticos en memoria, sin red ni escrituras. Controles: negación explícita, ausencia de etiqueta, petición positiva, valores yes/no/partial, privacidad, comuna normalizada y distinta, inactividad, doble negación, cláusulas no reconocidas, OR, horario no soportado, accesibilidad compuesta, contradicciones, campos no admitidos, criterios vacíos y retención pese a puntuación alta.

Es una evaluación del contrato, no una medida de precisión lingüística. No se volvieron a generar embeddings ni se ejecutaron compilaciones o la batería general.

## Integración pendiente

### Contraste con la muestra ejecutado

El 18/11/2026 se ejecutó `node Backend/scripts/evaluate-sample-requirements.cjs --public-dns`, código 0. Se leyeron exclusivamente las cinco fichas de la muestra en `koinonia_synthetic_test_v2_local`, con proyección de campos necesarios y sin contactos ni cuentas. Se reutilizó el ranking previo, comprobando su hash de origen. Los 15 fragmentos continuaban presentes, públicos y con el mismo hash; no hubo fragmentos obsoletos que retirar. No se escribieron datos remotos ni se llamó a Ollama.

Se evaluaron las 12 consultas originales en modo automático y otras 5 ejecuciones con criterios estructurados explícitos fijados antes de ejecutar. No confundir estas últimas con extracción automática:

- Gramática automática: resolvió negación de deportes y accesibilidad compuesta; las otras 10 consultas quedaron pendientes de aclaración. Incluso la formulación original positiva sobre deportes queda fuera de la gramática actual.
- Sin deportes: Corpus Domini y Bíblica Alma contradicen el requisito; las otras tres fichas no ofrecen evidencia suficiente. Cero aceptadas.
- Lengua de señas y baño accesible: cinco resultados sin información suficiente; cero aceptados.
- Cursos y conferencias (criterios explícitos): Metodista Libre y Cristiana AR chile aceptadas.
- Deportes (criterio explícito): Corpus Domini y Bíblica Alma aceptadas.
- Culto litúrgico y eucaristía (criterios explícitos): Corpus Domini aceptada.
- Streaming en Ñuñoa (criterios explícitos): Cristiana AR chile aceptada; las otras cuatro contradicen la comuna solicitada.
- Bautismo de creyentes (criterio explícito): Bíblica Alma aceptada.

Esto verifica el comportamiento con datos declarados en la copia, no autenticidad institucional ni precisión sobre el catálogo. No se modificó la gramática para mejorar retrospectivamente el resultado. La prueba demuestra tanto la utilidad de la barrera como su cobertura automática todavía reducida.

Artefactos: `outputs/church-embeddings-local/requirements-report-2026-11-18T05-37-36-259Z.json` y `requirements-review-2026-11-18T05-37-36-259Z.md`. El informe incluye criterios, orden de candidatos, evidencia pública y motivos de retención. La lectura representa una instantánea, no garantiza visibilidad futura.

La evaluación anterior sobre 15 fragmentos conserva sus resultados originales. Esta validación no se aplicó a esos fragmentos porque no contienen todos los datos estructurados necesarios: no reconstruir una ficha ni interpretar ausencias a partir de un recorte. Para la siguiente evaluación combinada hay que recuperar las fichas actuales de la copia autorizada, aplicar sus datos públicos y guardar un informe que separe similitud, requisitos resueltos y razones de retención.

Ampliar la gramática requiere casos de evaluación independientes y manejo de ambigüedad. La búsqueda pública, los filtros tradicionales y Qwen permanecen sin cambios.
