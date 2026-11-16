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
