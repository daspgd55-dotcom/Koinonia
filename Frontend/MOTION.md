# Animaciones de interfaz

PageMotion conserva los componentes montados: no usa una key de ruta ni retrasa navegación, guardado o clics. Aplica una entrada de opacidad de 180 ms al cambiar de ruta. IntersectionObserver anima una vez por elemento y visita las tarjetas y secciones al entrar en pantalla (fundido de 320 ms, sin mover los controles durante un clic), incluyendo contenido recibido de la API. No intercepta el scroll: ratón, pantalla táctil y teclado mantienen su comportamiento nativo.

El contenido nunca depende de una clase oculta para mostrarse. Si faltan IntersectionObserver o Web Animations, permanece accesible. MutationObserver incorpora tarjetas nuevas sin escuchar cada evento de scroll. Al desmontar/cambiar ruta se cancelan observadores y animaciones. Al enfocar un control se termina cualquier animación de sus contenedores.

CSS añade cambios de color, elevación leve en hover, presión de botones, selección de opciones y apertura de secciones. No se transforman mapas ni herramientas de recorte. La preferencia prefers-reduced-motion cancela el movimiento, también si cambia durante la sesión.

Verificación: npm run test:explore, npm run test:discover, npm test y npm run build. La prueba de búsqueda comprueba aparición al desplazar con teclado, contenido visible sin movimiento, navegación conservando filtros y ausencia de desbordamiento móvil.
