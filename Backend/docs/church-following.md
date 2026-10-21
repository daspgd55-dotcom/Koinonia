# Seguimiento de iglesias

En la ficha pública, junto al banner, «Seguir» con corazón permite suscribirse a nuevas publicaciones de eventos. «Siguiendo» permite retirarlo. No cambia Mi iglesia, iglesias guardadas, roles ni participación en eventos. Los visitantes reciben un enlace al login que regresa a la iglesia; el seguimiento se confirma pulsando el botón después de iniciar sesión.

## Contrato y privacidad

- GET `/api/churches/:id/follow`: autenticado, iglesia pública; `{data:{following:boolean}}` del usuario de la sesión.
- PUT `/api/churches/:id/follow`: autenticado, cuerpo estricto `{following:boolean}`. Seguir exige iglesia pública; retirar permite limpiar una relación aunque la iglesia se haya ocultado. No admite IDs de otros usuarios.
- ChurchFollow tiene índice único usuario/iglesia, active, since y recibos de lectura. Altas simultáneas no duplican relaciones; reenviar true conserva since, reactivar tras retiro lo reinicia. No hay lista pública de seguidores.

## Avisos internos

La transición a publicado registra una única publicationNotice en el propio evento y en la misma escritura protegida por versión. Los avisos se obtienen por consulta con los seguimientos anteriores a esa publicación, sin correos ni worker adicional. Incluye eventos organizados por comunidades vinculadas de la iglesia propietaria; no sigue automáticamente a iglesias colaboradoras.

GET `/api/notifications` integra estos avisos con source=event, audience=follower y kind=published. Se abren y marcan leídos por el endpoint existente; un usuario no puede marcar los del otro. Editar/republicar un evento con publicationNotice no crea otro aviso. No hay avisos retroactivos al comenzar a seguir. Eventos históricos sin marcador no generan avisos automáticamente; su primera nueva transición a publicado bajo este sistema registra el marcador.

Despublicar/archivar, ocultar la iglesia o comunidad organizadora, cancelar, dejar de seguir o superar tres días desde el término retira el aviso de seguimiento del listado y contador. Los registros se conservan. Si vuelve a ser visible sin haber dejado de seguir, conserva su lectura. Los avisos de cambios/cancelación para participantes siguen teniendo su comportamiento propio.

## Recomendación de eventos

El ranking de eventos utiliza el seguimiento activo después de Mi iglesia y antes de popularidad. Seguir no modifica la pertenencia ni implica inscripción o asistencia. Contrato y reglas: [event-recommendations.md](event-recommendations.md).

## Comprobaciones

`node --test --test-concurrency=1 test/events.test.js test/event-participation.test.js test/event-collaboration.test.js`: seguimiento concurrente, aislamiento, permisos, lectura, retiro/reactivación, comunidad organizadora y no duplicación, junto con regresiones de participación y colaboración. Bases efímeras, sin datos de producción.

`node test/public-events.cjs` desde Frontend verifica ficha, seguimiento persistido y retirada en navegador, además del recorrido público de eventos. `npm run build` comprueba compilación.

## Total público de seguidores

GET `/api/churches/:id/followers/count` es público solo para iglesias disponibles y devuelve `{data:{followers:number}}`. Cuenta relaciones activas, sin nombres, correos ni IDs de usuarios. GET/PUT de seguimiento incluyen el total para actualizar la ficha al pulsar el botón. Retirar seguimiento de una iglesia oculta sigue permitido, pero no devuelve su total. La interfaz distingue «1 seguidor» y «0 seguidores».
