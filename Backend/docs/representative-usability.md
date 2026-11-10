# Edición y bienvenida

- La ayuda de sección puede reabrirse aun después de desactivar consejos automáticos. No incluye manual descargable.
- Los errores de contrato con `details[].path` abren la sección correspondiente y enfocan campos simples, líderes, reuniones y recursos. Los errores de sección sin control específico enfocan el encabezado. El borrador permanece en memoria; no hay recuperación tras recargar.
- La selección de encargados consulta cuentas activas y permisos del servidor. Editores no son elegibles. Solo el administrador global conserva acceso fuera de la selección.
- `visitSettings.welcomeEmailEnabled` es opcional y predeterminado true. Al crear nuevas visitas, las cuentas activas asignadas con subrol welcome reciben aviso si tienen acceso según all/selected. No se activan solicitudes de visitas en iglesias que las tengan deshabilitadas.
- `emailEnabled` sigue controlando únicamente los destinatarios adicionales configurados manualmente. Los dos grupos se normalizan y deduplican. Es posible desactivar los avisos automáticos por iglesia.
- Se reutilizan transporte Resend y outbox existentes. `accepted` significa aceptación del transporte, no entrega confirmada. El mensaje no incluye datos personales del visitante. No se envían avisos retroactivos ni se modifica la configuración externa.
- La cola conserva el comportamiento existente: destinatarios calculados al crear el aviso. No se añadió revalidación de permisos justo antes del envío diferido ni un mecanismo nuevo de reintentos para transporte directo.
- Implementación revisada mediante lectura de código; sin pruebas, compilación ni envíos reales en esta tarea.
