# Fichas públicas: jerarquía y contenido

- Iglesia: identidad y verificación administrativa, presentación, ubicación/reuniones y contacto antes de acciones sociales, eventos y detalle secundario.
- Seguir y compartir se agrupan en un área secundaria; el contador de seguidores conserva su propia línea. Mi iglesia conserva su asociación independiente. Guardar sigue gestionándose desde las recomendaciones y Guardadas; no se convierte en seguimiento ni pertenencia.
- Comunidad vinculada: iglesia de origen explícita, ubicación y contacto antes del público y responsables. La información breve comparte un panel adaptable. No recibe insignia propia.
- Los grupos sin información se ocultan. Experiencias y Testimonios mantiene sus cuatro categorías y sus permisos: sin publicaciones se oculta para visitantes, pero permanece disponible para miembros que pueden escribir. Los errores siguen siendo visibles y recuperables.
- Se reutilizan las consultas públicas y los componentes de fotos, marcos y visitas. No se cambian permisos, proyecciones de privacidad ni reglas de publicación.

Pruebas locales:

- `node Frontend/test/public-profiles.cjs`: API simulada, escritorio/móvil (320, 390, 1440), teclado, títulos largos, falta de fotos, grupos vacíos, comunidad no disponible.
- `node --test Backend/test/linked-communities.test.js`: base temporal, publicación, visibilidad, privacidad, permisos y concurrencia.
- `node Frontend/test/experiences.cjs`: recorrido real con base temporal, asociación y experiencias.
- `node Frontend/test/motion.cjs`: desplegables y movimiento reducido.
- `npm --prefix Frontend run build` y `git diff --check`.

No se consulta producción ni se envían correos reales en estas pruebas.
