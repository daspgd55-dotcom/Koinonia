# Paneles administrativos: presentación unificada

Se comparten estilos acotados a `.admin-panel` y estados vacíos `PersonalEmpty` en Usuarios, moderación de Experiencias, Primeras visitas, Colaboraciones y Seguridad.

- Usuarios mantiene búsqueda visible; rol y estado se agrupan en un desplegable. No se considera urgente una cuenta por no verificar su correo.
- Experiencias conserva la revisión pendiente inicial; instrucciones de moderación en detalles y formularios visibles ante errores de acción.
- Visitas destaca el filtro Sin confirmar y agrupa el filtro de comunidad. Conserva lecturas y resolución compartida.
- Colaboraciones presenta primero pendientes dentro de cada página recibida, sin cambiar la consulta ni atribuir orden global.
- Seguridad presenta métricas primero, accesos a fallos/reintentos y detalles de configuración, auditoría y mantenimiento. Consultar o desplegar no ejecuta envíos, reintentos ni limpieza.
- Paginadores aparecen solo cuando permiten recorrer páginas (también conservan regreso desde una página posterior vacía).

## Comprobaciones
`node Frontend/test/admin-panels.cjs`: respuestas API simuladas, cinco paneles, vacíos, errores, registros con títulos largos y sin avatar, anchos 320/390/1440, desplegables con teclado, movimiento reducido, ninguna petición de escritura.
`npm --prefix Frontend run build` y `npm --prefix Frontend run test:motion`.

No se modificaron endpoints, autorización, condiciones de moderación, acciones de visitas ni configuración de seguridad. La prioridad de colaboraciones es local a la página; la disponibilidad de datos del proveedor depende de la configuración existente. Pruebas móviles mediante navegador emulado, no dispositivo físico ni lector de pantalla real.

Regresión de primeras visitas: aprobada (recepción, notificaciones, cancelación, historial y privacidad). No se ejecutaron acciones reales de correo ni mantenimiento.
