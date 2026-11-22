# Separación de responsabilidades del cliente

## Ficha y roles

- `Frontend/src/churchEditorConfig.js`: estados y definición de secciones/campos del editor.
- `Frontend/src/churchEditorData.js`: lectura/escritura de rutas, limpieza y transformación entre ficha recibida, borrador y payload. Conserva las conversiones heredadas, identificadores de liderazgo y referencias multimedia.
- `Frontend/src/RepresentativeAssignment.jsx`: resumen de asignación, alcance y consulta diferida de comunidades/eventos. `Manage.jsx` mantiene el estado del editor, navegación, guardado y concurrencia.
- `Frontend/src/representativeRoles.js`: textos de roles para invitación, revisión, aceptación y equipo, más selección del manual según permisos efectivos. Los textos contextuales se mantienen distintos cuando corresponde.

Este catálogo del cliente no concede permisos ni sustituye las validaciones del backend. El contrato de API y los roles del servidor no cambian. No se unifican los catálogos de frontend/backend mediante rutas externas a sus carpetas de despliegue, ya que ambos pueden desplegarse de forma independiente.

## CSS y configuración

Los estilos del resumen de contenido se separaron en `RepresentativeContents.css`, importado por `RepresentativeDashboard.css`. Se mantienen selectores, valores, puntos de adaptación móvil y reglas existentes; las declaraciones del panel se separaron por selector para facilitar su mantenimiento. No se eliminaron reglas `!important` sin comprobar su interacción con el CSS global.

`clientConfig.js` reúne intervalos de consultas, sincronización completa de chat, agrupación de eventos y ventana de diagnóstico. Conserva los valores anteriores. No contiene secretos, parámetros de envío, políticas de seguridad ni cambia la configuración del piloto en el servidor.

## Fallos recuperables

`recoverableError.js` registra en consola únicamente identificadores de operación permitidos, como `chat.summary`, con un máximo de un aviso por operación por minuto. No recibe objetos Error, URL, correo, token, identificadores de usuarios ni respuestas del servidor. No persiste datos ni envía telemetría.

Se aplica a contadores de notificaciones/mensajes, errores inesperados del planificador, consulta de capacidades y bienvenida del representante. Las operaciones secundarias mantienen su comportamiento no bloqueante. Las cancelaciones tras desmontar el consumidor no se registran como fallos. Los errores de formularios y listas que ya se muestran al usuario conservan sus avisos.

## Alcance y validación

Esta fase reorganiza las piezas indicadas, no supone una reescritura completa de `main.jsx`, formularios, administraciones ni estilos globales. Tampoco modifica transporte de correo, políticas operativas o credenciales. No se ejecutaron pruebas, compilación ni mediciones; se revisaron los cambios por lectura del código y diff. Queda pendiente comprobar visualmente los paneles y sus vistas móviles, manuales por rol, edición/guardado y diagnósticos antes de publicar.

## Continuación: acceso, administración e invitaciones

`main.jsx` delega el acceso/registro y desafío MFA en `Auth.jsx`, la navegación y permisos administrativos en `AdminArea.jsx`, y las piezas visuales reutilizadas en `Notice.jsx` y `Landscape.jsx`. Conserva la sesión, las rutas y el estado de preferencias. Las vistas administrativas siguen usando carga diferida. La consulta de permisos cancela su solicitud al cambiar de contexto y registra `admin.permissions` ante un fallo recuperable; mantiene la restricción de permisos por defecto.

La bandeja `ChurchOutreachAdmin.jsx` mantiene los borradores de preparación y revisión, selección de destinatarios y navegación. Delega en:

- `ChurchOutreachPreparation.jsx`: búsqueda de ficha existente, procedencia y preparación sin envío.
- `ChurchOutreachDetail.jsx`: contexto institucional, revisión, concurrencia, historial y acciones explícitas.
- `churchOutreachDelivery.js`: envío de representantes aprobados y compatibilidad mediante vista previa/lote cuando la ruta específica no existe. No se ejecuta al importar el módulo y no cambia cuotas, exclusiones ni claves de idempotencia existentes.
- `churchOutreachAdminConfig.js`: rutas, etiquetas, formato de presentación y borrador vacío. Reúne la paginación de 20 filas y máximo de 25 destinatarios ya establecidos por la API; no configura ni modifica las políticas del servidor.

`ChurchOutreachAdmin.css` conserva el punto de importación y carga explícitamente `ChurchOutreachAdminBase.css` y `ChurchOutreachAdminPanels.css`, en ese orden. Las reglas originales se distribuyen sin eliminar declaraciones ni invertir precedencias, incluidas las reglas móviles y de movimiento reducido.

Esta continuación tampoco ejecutó pruebas, compilación, navegador, envíos o cambios externos. La revisión fue por lectura de código y diff, sin afirmar mejoras de velocidad medidas. Antes de publicar queda pendiente comprobar acceso/registro/MFA, navegación administrativa, conservación de borradores, revisión y simulación de envíos, y presentación móvil. El ZIP preexistente no fue modificado ni regenerado por esta tarea.
