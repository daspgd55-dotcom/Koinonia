# Manuales de representantes

Los cuatro PDF de esta carpeta se sirven como recursos públicos y se incluyen en la distribución del frontend. Son guías genéricas, sin datos privados ni credenciales.

El componente `src/ManualDownload.jsx` muestra la descarga correspondiente a los permisos de la iglesia seleccionada. En la bandeja general usa los permisos disponibles de la sesión (prioridad: administración, moderación, edición, bienvenida). El administrador global dispone del manual de Administrador y del selector de los demás.

Para actualizar un manual, reemplazar el PDF del mismo nombre con la edición aprobada de `output/pdf/`. Actualizar esta copia no publica cambios por sí solo: requiere el procedimiento habitual de compilación y despliegue del frontend.

No se ejecutaron pruebas ni compilación ni se desplegó esta integración.
