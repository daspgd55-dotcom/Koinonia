# Páginas personales y chat

Guardadas, Amigos, Mis eventos, Mis visitas y Notificaciones comparten escala de títulos, espaciado, foco y estados vacíos. Cada vacío describe el contenido y ofrece un destino útil cuando corresponde. No se muestran controles de paginación con una sola página; si se vacía una página posterior, sigue disponible Anterior.

Amigos y Solicitudes son accesos principales. Historial y Bloqueados permanecen en un despliegue secundario. No cambian autorizaciones ni acciones.

El chat móvil compacta encabezado, identidad y compositor. Usa VisualViewport cuando está disponible para ajustar altura y posición al espacio visible, con respaldo de unidades dvh. Restaurar recupera el foco del compositor; cerrar devuelve el foco al control de apertura. Borradores y tarjetas compartidas mantienen su implementación, al igual que el sondeo en segundo plano y los estados de lectura. Las notificaciones generales no incorporan mensajes.

Pruebas con datos aislados: `node Frontend/test/personal-pages.cjs`, `node Frontend/test/social.cjs`, `node Frontend/test/visits.cjs`, `node Frontend/test/event-participation.cjs`, y compilación de Frontend. La prueba de teclado móvil reduce el área visible en navegador automatizado: no abre un teclado nativo de Android/iOS; la comprobación física sigue siendo recomendable.
