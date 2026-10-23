# Inicio personal

GET `/api/users/me/home?page=1` requiere sesión y devuelve Cache-Control: no-store. La identidad se toma del token. Activa personalized cuando existe pertenencia, un seguimiento activo o una iglesia guardada; guardar no implica seguir.

Devuelve membership (tarjeta pública o null), hasMembership, hasSaved, followingCount, following (12 tarjetas públicas por página), followingPagination y events (hasta seis publicaciones visibles de iglesias seguidas, ordenadas por publicación reciente y luego fecha). Incluye eventos finalizados hasta tres días después de effectiveEndsAt, y cancelaciones con su estado. No incluye correos, responsables internos ni datos de iglesias ocultas. El conteo de seguimientos incluye asociaciones conservadas aunque una iglesia deje de ser pública; la lista solo muestra las públicas.

Visitantes y cuentas sin relaciones mantienen la portada original. Inicio personal presenta Mi iglesia primero, novedades y listado desplegable de seguidas, además del acceso a Guardadas si corresponde. No crea notificaciones ni marca avisos como leídos. No presenta cambios de ficha como novedades: actualmente estas son eventos publicados. Actualizar vuelve a consultar; no hay sondeo automático.

Pruebas: `node --test Backend/test/event-participation.test.js`, `node Frontend/test/personal-home.cjs`, `node Frontend/test/home-layout.cjs`. Datos aislados; cubrir sin relaciones, solo guardadas, pertenencia, seguimiento, iglesia oculta, aislamiento y error de consulta.
