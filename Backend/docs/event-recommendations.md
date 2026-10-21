# Recomendación de eventos

El directorio solicita `GET /api/events?sort=recommended`; acepta sesión opcional validada por el servidor. Sin sesión usa popularidad. `sort=date` conserva el orden cronológico; es el valor predeterminado de la API para compatibilidad. La interfaz ofrece ambos órdenes en «Más filtros» y conserva la elección en la URL.

Primero se muestran eventos vigentes no cancelados, luego cancelados futuros y finalmente finalizados dentro de la ventana existente de 72 horas. Dentro de cada grupo se ordena, estrictamente, por:

1. Iglesia propietaria igual a «Mi iglesia» del usuario.
2. Iglesia propietaria seguida activamente por el usuario.
3. Total de seguidores activos de la iglesia propietaria.
4. Visualizaciones únicas autenticadas del evento.
5. Participaciones activas «Me interesa».
6. Fecha de inicio e identificador para resolver empates.

No se suman pesos: ninguna cantidad de visualizaciones supera la prioridad de pertenencia o seguimiento. Las comunidades usan su iglesia propietaria. Las colaboraciones no transfieren estas señales. Cambiar «Me interesa» a «Voy a asistir» retira el interés del conteo, conservando la exclusión mutua existente. No es una clasificación de calidad espiritual ni un recomendador LLM/RAG.

## Visualizaciones y privacidad

`POST /api/events/:id/view`, autenticado, recibe cuerpo vacío y devuelve `{ok:true}`. Solo admite eventos públicamente disponibles. La ficha registra la apertura cuando la página está visible. El índice único `(event,user)` impide sumar recargas o peticiones simultáneas; no hay API para enviar un conteo arbitrario. Una consulta GET o una vista previa administrativa no suma visitas.

Esta primera versión conserva una visualización por cuenta/evento durante la vida del registro, sin IP, identificadores de dispositivo ni rastreo anónimo. No equivale a personas únicas ni mide todo el tráfico. Los registros no tienen TTL; quedan como datos internos para deduplicación y ranking. No se exponen conteos, identidades ni campos de cálculo en respuestas públicas. Las respuestas usan `no-store`; el usuario se obtiene de la sesión, nunca de un parámetro de consulta.

El ranking aplica permisos, visibilidad y filtros antes de ordenar y paginar. Borradores y contenido oculto siguen excluidos. La agregación utiliza índices de seguimiento, visualización y participación; medir rendimiento con grandes volúmenes y estudiar agregados precalculados queda pendiente.

## Participación en cabecera

«Me interesa» con pulgar y «Voy a asistir» están en la cabecera, con estado seleccionado y retirada. Se elimina la sección «Mi participación». En eventos de inscripción requerida solo se ofrece interés: la API rechaza `going` con 409 `REGISTRATION_REQUIRED`. Una intención anterior conservada puede retirarse; no se borra silenciosamente. Las instrucciones oficiales siguen visibles, sin implementar inscripción dentro de Koinonía.

## Pruebas aisladas

- Backend: `node --test --test-concurrency=1 test/event-ranking.test.js test/event-participation.test.js test/events.test.js`.
- Frontend: `node test/event-participation.cjs`, `node test/public-events.cjs` y `npm run build`.

Cubren prioridades, invitados, paginación, privacidad, manipulación de parámetros, conteo concurrente único, visibilidad y restricciones de inscripción; navegador para login con regreso, selección, retirada, notificaciones, filtros y móvil. Usan bases efímeras y cuentas ficticias.

## Total de interés y enlaces compartibles

GET `/api/events/:id/interest-count` es público para eventos visibles y devuelve exclusivamente `{data:{interested:number}}`. Cuenta estado `interested`, no `going` ni `withdrawn`. No publica identidades, asistencia ni visualizaciones. Un evento oculto o de iglesia no pública devuelve 404. La ficha actualiza el total al cambiar la participación y distingue singular/plural.

Eventos e iglesias incluyen «Compartir». Se construye el enlace desde el origen y ruta base actuales, con `#/evento/:id` o `#/iglesia/:id`, sin parámetros de retorno, filtros ni credenciales. Funciona en el dominio provisional de Render; enlaces antiguos no se redirigen automáticamente al cambiar de dominio. Los permisos públicos siguen aplicándose al abrir el enlace.

Si el navegador ofrece Web Share, se solicita su panel nativo desde el clic; las aplicaciones disponibles dependen del dispositivo. Cancelarlo no copia nada. También se ofrece copiar el enlace. Sin Web Share se usa Clipboard; si falla el permiso, se presenta un campo seleccionable para copia manual. HTTPS (o localhost en desarrollo) permite estas APIs. No se incorporan SDK de redes sociales ni publicación automática. Las vistas enriquecidas en redes no se implementan: las rutas hash comparten el documento HTML inicial.

Pruebas de navegador simulan Web Share y Clipboard (éxito y fallo) y verifican los enlaces de eventos/iglesias y la actualización del total. El selector nativo de aplicaciones requiere comprobación manual en el dispositivo real.
