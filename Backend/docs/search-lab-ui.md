## Actualización: revisión previa editable (19/11/2026)

La pantalla ahora separa dos acciones: **Revisar interpretación** y **Confirmar y consultar muestra**. El endpoint local `POST /interpret` recibe `{query}` para separar automáticamente, o `{query, review: {requirementsText, interestText}}` para revisar cambios. No consulta Ollama ni MongoDB. Los fragmentos desconocidos se mantienen en condiciones para aclararlos; no se transforman automáticamente en intereses.

Los campos editables explican que trasladar una condición a intereses la vuelve opcional. La validación de condiciones admite varias cláusulas separadas por punto y coma y conserva alternativas de comuna, negaciones y controles de contradicción existentes. Un interés escrito dentro del campo obligatorio también queda pendiente de aclaración. La gramática sigue siendo limitada; la interfaz muestra un ejemplo de escritura admitida.

`POST /query` acepta opcionalmente el mismo objeto `review`, validado estrictamente y reconstruido en el servidor: no acepta criterios ni planes enviados por el navegador. Se conserva `{query}` para los scripts anteriores. La respuesta conserva consulta original y edición explícita en `intent.review`. Los requisitos se verifican con evidencia estructurada actual; la similitud no acredita cumplimiento. Cuando hay dos variantes se selecciona inicialmente la de intereses, manteniendo el texto completo para comparación. Esto es una decisión experimental, no una mejora de precisión demostrada.

Editar invalida la confirmación anterior; respuestas tardías de revisiones o búsquedas obsoletas se descartan. Los campos se conservan ante fallos. Controles nativos con etiquetas, foco y avisos accesibles; sin animaciones. Límite de cuerpo ajustado a 16 KiB para tres textos Unicode de hasta 1000 caracteres cada uno.

No se activó LFM3 ni se modificó la aplicación pública. En esta edición se revisó el código, sin ejecutar pruebas, compilación ni consultas a servicios. Requiere reiniciar el servidor local para cargar las nuevas rutas y recargar la pantalla. Las comprobaciones relatadas abajo corresponden a versiones anteriores.

# Pantalla experimental local

## Evaluación manual en el navegador

Cada candidato, admitido o retenido, permite elegir **Útil**, **Relacionado, pero insuficiente** o **No responde**, con comentario opcional de hasta 1000 caracteres. «Sin evaluar» no se cuenta como juicio. También se puede valorar la interpretación de la consulta, incluso cuando se solicita aclaración y no hay candidatos. Se evalúa utilidad de la respuesta, no calidad de la iglesia.

Se guardan exclusivamente en `localStorage` del origen local, bajo `koinonia-search-lab-feedback-v1`. Solo crear una valoración/comentario guarda la consulta correspondiente. Cada registro conserva ID de ejecución, consulta enviada, método, fragmento/iglesia, evidencia, estado, puntuación, muestra e interpretación. Una consulta nueva crea otra ejecución; alternar métodos conserva sus valoraciones independientes. El comentario o puntuación no altera rankings.

El panel **Tu evaluación del buscador** muestra cantidades, exporta JSON y permite borrar los registros locales con confirmación. El archivo exportado incluye consultas y comentarios: revisarlo antes de compartirlo. Borrar en el navegador no borra las descargas. No se envían evaluaciones al servidor ni a MongoDB. Si el navegador impide guardar, se muestra un aviso y se conserva lo nuevo en memoria para exportar. Límite: 500 registros; al alcanzarlo hay que exportar y borrar antes de continuar.

Se añadieron 12 consultas en **Más consultas para probar**, incluyendo requisitos, temas descriptivos, mezclas, negaciones, accesibilidad, horarios, tema médico sin evidencia, ubicación alternativa y pregunta fuera del dominio. Pulsarlas solo rellena el campo; no ejecuta la consulta. Son ejemplos de exploración, no evaluación ciega: para medir generalización también escribir consultas propias antes de mirar las fichas.

Comprobación de esta edición: `node --check Backend/scripts/search-lab-ui/lab.js` correcto. No se realizó recorrido de navegador ni prueba automatizada del almacenamiento/descarga. Los archivos estáticos se sirven en cada petición: recargar la página aplica los cambios sin reiniciar el servidor. Las menciones históricas a «consultas sin guardar» se refieren al servidor; esta edición añade guardado local únicamente al evaluar.

Actualización: la muestra ampliada de **20 iglesias y 45 fragmentos** se activa con `node Backend/scripts/serve-search-lab.cjs --public-dns --expanded`. Sin ese argumento se mantienen las cinco originales. La pantalla muestra las cantidades del servidor. Véase `expanded-search-evaluation.md` para la evaluación de consultas sin evidencia y sus limitaciones; no hay un umbral automático de pertinencia.

## Comparación de recuperación y evidencias

Cuando hay intereses descriptivos, se generan dos embeddings en la misma consulta: texto completo (referencia) e intereses concatenados (experimental). El selector de la pantalla permite alternar los rankings ya calculados sin nuevas llamadas. Se muestra inicialmente la consulta completa, sin adoptar la variante experimental antes de evaluarla. Si no hay intereses, solo se ofrece la consulta completa.

Ambos métodos usan los mismos fragmentos vigentes, las mismas fichas leídas y la misma validación de requisitos originales. Cambian únicamente la recuperación y el mejor fragmento por iglesia. La comuna no se elimina del requisito ni del contexto de los documentos indexados; solo deja de formar parte del texto de consulta vectorial en la variante descriptiva.

Las tarjetas separan «Cumple / No cumple / Por confirmar» con evidencia estructurada del texto recuperado. El fragmento es una cita de la ficha, sin explicación generativa ni promesas sobre actividades. La similitud queda en un desplegable «Detalles técnicos». No se deduce que una puntuación mayor entre dos formulaciones sea una mejora de precisión; requiere evaluación de pertinencia independiente. Se conserva la ausencia de umbral calibrado.

Se comprobó sintaxis de servidor y cliente con `node --check` y se reinició el servidor local para aplicar los cambios. No se modificó la aplicación publicada ni se ejecutó compilación.

Comparación ejecutada con «Necesito una iglesia en La florida, me gustaría que se muevan hacia los de afuera.»: ambos métodos aceptaron Bíblica Alma por la comuna y recuperaron `identification.description`; cuatro candidatas retenidas en ambos. Coseno completo 0,442746; solo interés 0,211660. Se usó Ollama local y lectura de las cinco fichas, sin escrituras. No se concluye superioridad a partir de una consulta o del valor de coseno. No se hizo recorrido visual en navegador.

Abrir **http://127.0.0.1:4600/**. Servidor independiente de Express y de la app React/Vite publicada. Los archivos de la pantalla están bajo `Backend/scripts/search-lab-ui/`, fuera de los directorios públicos de la aplicación. No se añadieron rutas ni enlaces a producción.

Desde la raíz del repositorio:

```powershell
node Backend/scripts/serve-search-lab.cjs --public-dns
```

Requiere las dependencias existentes del backend, el artefacto `sample-vectors-2026-11-18T05-21-16-806Z.json`, Ollama con embeddinggemma en `127.0.0.1:11435` y `Backend/.env` apuntando exactamente a `koinonia_synthetic_test_v2_local`. No muestra ni transmite la URI al navegador. El parámetro DNS es opcional y afecta solo al proceso. Detener con Ctrl+C en la terminal que lo ejecuta. El puerto es fijo: 4600.

## Funcionamiento

1. Interpreta la frase libre. Una parte no reconocida presenta aclaración sin consultar servicios externos.
2. Verifica modelo/digest y genera un embedding de consulta en Ollama local.
3. Lee exclusivamente las cinco fichas de la muestra en la copia remota autorizada, con proyección de campos públicos necesarios y controles de privacidad. No escribe en MongoDB.
4. Retira fragmentos cuyo texto/privacidad/visibilidad haya cambiado respecto al vector almacenado. Calcula coseno en memoria sobre los fragmentos vigentes y toma el mejor por iglesia.
5. Aplica los requisitos sobre datos actuales. Presenta candidatos admitidos y retenidos, evidencias, similitud y fragmento recuperado.

Los candidatos solo descriptivos tienen pertinencia pendiente de revisión; no se ha calibrado un umbral de «sin coincidencias». La puntuación no es un porcentaje de compatibilidad. La validación comprueba declaraciones de una ficha, no autenticidad institucional. La muestra puede contener datos de prueba. No incluye todo el catálogo ni actualiza embeddings automáticamente.

## Acceso y alcance

Enlaza únicamente `127.0.0.1`, rechaza ejecución con `NODE_ENV=production`, exige Host fijo y Origin propio para POST, y no habilita CORS. No cambiar el bind a `0.0.0.0`, no publicar por túnel ni montar en el backend público. Es una herramienta para el usuario del equipo, sin sesión de la app; no un panel multiusuario autorizado para red local.

Solo procesa una consulta a la vez, limita cuerpo/longitud y controla errores sin devolver secretos ni mensajes crudos de proveedores. No persiste consultas ni resultados. El navegador conserva el texto durante errores; recargar lo descarta. Los cambios de consulta no sobrescriben la que identifica un resultado ya recibido.

La interfaz usa HTML semántico, etiquetas, foco visible, avisos accesibles, detalles nativos y disposición móvil. No carga fuentes ni librerías externas y no usa animaciones. Los textos recuperados se insertan con `textContent`.

## Comprobación realizada

La página `/` respondió HTTP 200 y `/status` confirmó 5 iglesias, 15 fragmentos y el modelo esperado. La primera comprobación HTTP fue bloqueada por permisos del entorno; el reintento autorizado funcionó sin consultar MongoDB.

Se revisó sintaxis con `node --check`; se corrigió un cierre de objeto en la configuración de Helmet y el servidor arrancó en el puerto 4600. No se ejecutó compilación de la aplicación ni batería de pruebas. No se realizó recorrido visual en navegador ni una consulta completa desde esta pantalla; las evaluaciones previas de los servicios constan en sus documentos. El servidor queda iniciado para revisión local. No hubo commit, push, despliegue ni envío de correos.
