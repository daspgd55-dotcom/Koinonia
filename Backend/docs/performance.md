# Optimización de carga — 2026-10-22

## Alcance implementado

- Amigos: página de 30 relaciones con cuatro consultas de datos: relaciones, usuarios en lote, conteos agrupados y total. Autenticación y límites siguen activos y sus consultas no forman parte de ese número.
- Chat: `after` incremental, lectura solo al avanzar, recursos públicos resueltos por lotes, actualización de privacidad y reconciliación de ventana reciente cada 30 segundos. Ver friends-and-messages.md.
- Recomendaciones: cada resultado añade `saved: boolean`, calculado para el usuario autenticado y solo los candidatos devueltos. El frontend deja de descargar todo el historial de guardadas. Calidad se calcula una sola vez por candidato; inserción ordenada mantiene el mismo desempate sin ordenar repetidamente todo el top. No se recortan los candidatos personalizados.
- Búsqueda: `GET /api/churches/search?view=card` devuelve los campos necesarios para tarjetas y mapa; incluye una imagen seleccionada, una reunión y hasta dos actividades. `view=full` es el valor predeterminado y preserva compatibilidad. El detalle se consulta al abrir la ficha. Filtros, totales y orden no cambian.
- Eventos: proyecciones reducidas de iglesia y organizador; colaboradores después de paginar salvo cuando se usan para filtrar. Ordenación y ranking quedan en la rama de resultados del facet, no en el conteo. Se añade índice `{event:1,status:1}` a participaciones; los conteos siguen siendo exactos.
- API web: deduplicación de GET simultáneos por URL, identidad y cabeceras, máximo 100 solicitudes compartidas. Cada consumidor recibe una copia. Una escritura invalida el grupo en curso; errores no quedan retenidos. No se almacenan respuestas privadas en caché persistente. Requests con señal propia no se comparten. Se cancelan búsquedas obsoletas y consultas públicas desmontadas; el contenido actual permanece durante una actualización en segundo plano.
- Imágenes: tamaños responsivos para URLs Cloudinary HTTPS versionadas y sin firma; miniaturas de 160 px, tarjetas adaptadas, chat de 480 px y original para ampliar. Se conservan proporciones y foco. URLs externas, firmadas o transformadas previamente permanecen intactas. No se transforma ni reenvía el archivo original. Requiere que la cuenta Cloudinary permita esas transformaciones; no se modificó la configuración externa.

## Evidencia reproducible, no benchmark de producción

En `test/optimization.test.js`, con MongoDB temporal y datos sintéticos:

| Operación | Antes, derivado del código | Después, medido |
| --- | --- | --- |
| Listar 30 amigos | 62 consultas de datos | 4 |
| Respuesta de búsqueda para ficha extensa de prueba | 5.145 bytes (full) | 402 bytes (card) |

Los bytes corresponden al JSON sin compresión de esa fixture, no a un promedio real. No se ha medido latencia de Render/Atlas, percentiles p50/p95, ancho de banda real de Cloudinary ni capacidad máxima. No se usaron cuentas ni bases de producción.

## Comprobaciones

Desde Backend:

```powershell
node --test --test-concurrency=1 test/optimization.test.js test/api.test.js test/social.test.js test/events.test.js test/event-ranking.test.js test/event-collaboration.test.js
```

Desde Frontend, ejecutar cada comando por separado:

```powershell
node test/optimization.cjs
node test/social.cjs
node test/explore.cjs
node test/discover.cjs
node test/public-events.cjs
node test/loading.cjs
npm run build
```

El test de cliente usa fetch simulado: comprueba deduplicación, aislamiento por token, invalidación tras escritura, cancelación, contadores de carga y construcción de URLs responsivas. No llama a Cloudinary real.

## Límites y siguientes mediciones

El ranking personalizado aún evalúa todos los candidatos válidos; el ranking de eventos calcula señales exactas en MongoDB. No se añadieron Redis, conteos eventualmente consistentes, caché entre navegaciones ni WebSockets: requieren evidencia de carga y política de invalidación antes de introducir complejidad. Medir p50/p95, bytes, consultas y `explain(executionStats)` con datasets de tamaños crecientes antes de elegir nuevas estructuras. Verificar creación del índice al aplicar el código en el entorno correspondiente; no se desplegó aquí.

Una futura caché debe invalidar publicación, permisos, cambios de perfil, guardados y cierre de sesión. Una optimización nunca debe devolver borradores ni mezclar identidades.
