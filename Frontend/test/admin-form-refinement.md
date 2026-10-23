# Formularios de comunidades vinculadas y eventos

La iglesia de origen y las pestañas permanecen en ChurchAdminNav; la edición muestra un solo título del elemento. Los encabezados redundantes del listado se retiraron. Colaboración y conteos de eventos se consultan después de las acciones de publicación, fuera del comienzo del formulario.

AudienceTags comparte las opciones de público del catálogo y conserva valores personalizados existentes. Cada elección sigue enviándose en `audience: string[]`; máximo 50 entradas, 200 caracteres por entrada. Enter añade una etiqueta sin enviar el formulario. Las opciones seleccionadas pueden retirarse y los duplicados personalizados se detectan sin distinguir mayúsculas.

Guardar incluye un acceso a Publicación. Los pendientes de evento que corresponden a campos abren sus desplegables y enfocan el control. Las condiciones relativas a publicación de iglesia/comunidad siguen como explicación, sin cambiar permisos. Comunidad permite saltar al nombre faltante.

No cambian el contrato, If-Match, validaciones del servidor, ubicación copiada del evento, carga en borradores ni advertencias de cambios pendientes. Cancelación y archivado conservan confirmaciones y operaciones separadas.

Pruebas locales: `node Frontend/test/events-admin.cjs`, `node Frontend/test/linked-communities.cjs`, `npm --prefix Frontend run build`, `git diff --check`. Los recorridos usan cuentas y bases temporales, proveedor multimedia simulado, administrador y representantes; incluyen etiquetas personalizadas persistidas y foco de pendientes.
