# Presentación pública de eventos

El directorio conserva dos columnas en escritorio y una en móvil. Nombre y comuna están disponibles directamente; fecha, categoría, público, orden y periodo permanecen en «Más filtros». Los filtros aplicados siguen en la URL y pueden retirarse individualmente.

Al abrir una ficha desde el listado se recuerda su posición en memoria (máximo 20 recorridos). Al regresar se restaura cuando llegan los resultados; durante un breve periodo se ajusta a cambios de altura de las tarjetas. Cualquier interacción de rueda, tacto, puntero o teclado interrumpe ese ajuste. No se persiste información personal ni se cambia el ranking.

La ficha prioriza título, organizador, fecha legible, lugar y condiciones de participación. El contador de interés acompaña las acciones. Sin portada, fecha/lugar y participación aprovechan dos columnas en escritorio y una en móvil. Se conserva la herramienta multimedia y sus marcos.

Cancelación y finalización siguen visibles. La permanencia de eventos pasados continúa siendo 72 horas según el backend. «Voy a asistir» sigue indicando intención; los eventos con inscripción conservan su enlace/instrucciones oficiales y no muestran ese botón.

Comprobaciones: `node Frontend/test/public-events.cjs`, `node --test Backend/test/events.test.js`, `npm --prefix Frontend run build`, `git diff --check`. Los recorridos usan API y base temporal aisladas, sin producción.
