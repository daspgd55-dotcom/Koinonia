# Secciones del perfil público de iglesia

Tres pestañas: Sobre la iglesia; Comunidades y eventos; Experiencias y Testimonios. Barra fija al desplazarse, navegación con flechas/Home/End y foco accesible. Los paneles se conservan montados al cambiar pestaña para no perder formularios o respuestas.

Orden inicial: Sobre la comunidad, Visítanos (incluye bienvenida y aviso de visita), Reuniones, Identidad/doctrina/prácticas, Vida de comunidad, Contacto/enlaces. Las secciones sin datos se omiten. Redes y sitio web usan iconos con etiquetas accesibles; correo y teléfono conservan texto y filtros de privacidad.

En Identificación → Orden del perfil público se puede subir/bajar cada apartado y restablecer el orden. Se guarda con Guardar ficha y aparece en vista previa. Campo API opcional `sectionOrder`: array sin duplicados, máximo seis valores: `intro`, `visit`, `meetings`, `doctrine`, `life`, `contact`. Los apartados omitidos se añaden al final en orden predeterminado. Si un cliente antiguo omite el campo al guardar, se conserva el valor existente. Permisos de edición, validación y versión son los mismos de la ficha. No requiere migrar datos.

Comunidades y eventos muestra primero grupos publicados y después eventos asociados a la iglesia, incluidos los organizados por comunidades vinculadas, respetando visibilidad actual. Experiencias conserva categorías, membresía, moderación y privacidad existentes.

Comprobación: `node --test Backend/test/linked-communities.test.js`, `node Frontend/test/public-profiles.cjs`, `node Frontend/test/public-communities.cjs`, `npm --prefix Frontend run build`. Pruebas con datos aislados o respuestas simuladas.
