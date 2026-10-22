# Jerarquía de búsqueda y recomendaciones

- Buscar iglesias inicia con filtros plegados, mantiene sus valores y presenta las etiquetas aplicadas sobre los resultados. Abrir los filtros no ejecuta consultas. Aplicar cierra el panel; durante la actualización se conservan los resultados anteriores con una indicación explícita.
- Al regresar a Buscar iglesias desde una ficha, se conservan filtros, página y posición de desplazamiento durante la sesión montada. Recargar la aplicación inicia una búsqueda nueva; no se persisten ubicaciones privadas en almacenamiento del navegador.
- La cuadrícula mantiene dos tarjetas en escritorio y una en móvil.
- Para ti presenta el aviso de búsqueda por descripción de forma compacta. Los ejemplos y la entrada deshabilitada están en un despliegue secundario. No se implementa búsqueda semántica.
- Preferencias e historial siguen disponibles como herramientas auxiliares. Las coincidencias y el acceso al perfil ocupan un bloque común debajo de imagen y descripción. Las imágenes mantienen proporciones y marcos explícitos, sin estirarse para llenar la altura del texto.
- No cambian ranking, autorización ni acciones Guardar, Descartar, Ver otra y Deshacer.

Pruebas: `node Frontend/test/explore.cjs`, `node Frontend/test/discover.cjs`, `node Frontend/test/discovery-layout.cjs` y `node Frontend/test/motion.cjs`. Las primeras utilizan una base temporal; la prueba de presentación usa una API simulada. Cubren filtros, regreso, teclado, imágenes, títulos largos, 320/390/1440 px, carga/error/vacío y movimiento reducido. Compilar con `npm --prefix Frontend run build`.
