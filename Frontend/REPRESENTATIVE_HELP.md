# Ayudas de primera visita

`RepresentativeHelp` aparece solo al editar una ficha asignada con rol `representative`. Administradores y usuarios generales no reciben estas ayudas. Cada sección muestra su burbuja una sola vez por cuenta y navegador, compartiendo el historial entre comunidades asignadas.

El historial local contiene únicamente indicadores de secciones vistas y la decisión de desactivar ayudas, bajo `koinonia-representative-help-v1-<id>`. No guarda contenido de la ficha. Si el navegador bloquea localStorage se conserva durante la visita en memoria. Otro dispositivo o borrar los datos del navegador inicia nuevamente las ayudas; no se afirma que sea el primer acceso histórico de la cuenta.

Las burbujas no bloquean formularios. Se cierran tras 25 segundos, pausando mientras tienen hover, foco o la pestaña está oculta. Permiten Entendido, Mantener visible y No mostrar más ayudas. Cambiar sección cancela el temporizador anterior; las secciones no visitadas mantienen su ayuda pendiente. No cambian ni guardan datos de la comunidad.

Comprobar con `npm run test:help` y `npm run build`: roles, tiempo, cierre, mantener visible, persistencia, desactivar, escritorio y móvil.
