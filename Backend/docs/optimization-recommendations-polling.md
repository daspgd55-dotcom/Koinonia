# Recomendaciones y consultas periódicas

## Recomendaciones

El cursor de recomendaciones selecciona únicamente los campos usados por `rank` y `church-quality`. La proyección `rankingProjection` vive junto al cálculo de puntuación y debe actualizarse si este incorpora nuevos atributos. Se conserva la serialización pública antes de puntuar, los filtros, pesos, desempate por identificador y el límite histórico de 100 candidatos para consultas no personalizadas. Las personalizadas siguen recorriendo todos los candidatos elegibles.

Solo después de seleccionar los resultados se recuperan sus fichas completas en una consulta. Se reaplican los filtros y la serialización pública, se conserva la distancia calculada y se respeta el orden del ranking. Si una ficha desaparece o deja de satisfacer los filtros entre ambas lecturas, se omite; no se rellena esa posición. Las dos lecturas no constituyen una instantánea transaccional. No hay caché persistente de datos privados ni cambios de contrato de respuesta.

La búsqueda tradicional ya utiliza una proyección para `view=card`; esta intervención no modifica sus resultados.

## Chat y notificaciones

`Frontend/src/polling.js` centraliza la planificación usada por el contador de notificaciones, el contador de mensajes, la lista de chats y la conversación. Cada consumidor mantiene como máximo una consulta periódica en curso; eventos consecutivos se agrupan y un cambio recibido durante una consulta provoca una actualización posterior. Los distintos recursos conservan ciclos independientes.

Los intervalos son 15 segundos para notificaciones, 10 para el contador de mensajes y 5 para la lista y conversación, contados desde la finalización de la consulta. Se suspenden nuevas consultas mientras la pestaña está oculta y se reanudan al volver. Al desmontar o cambiar las dependencias se cancela la petición y se ignoran sus resultados. La lista y conversación requieren el panel abierto; el contador continúa funcionando con el panel cerrado.

Se mantienen la recuperación incremental de mensajes y la sincronización completa cada 30 segundos. Una respuesta que llega cuando la pestaña ya está oculta no inicia una confirmación de lectura. No se han añadido WebSockets, coordinación entre pestañas ni caché de respuestas.

## Validación pendiente

Cambios revisados mediante lectura del código y diff. No se ejecutaron pruebas, compilación ni mediciones de rendimiento en esta intervención. Antes de publicar, comprobar equivalencia del ranking, filtros públicos, geolocalización, cambios de sesión, foco/visibilidad, errores y recepción/lectura de mensajes en un entorno aislado.
