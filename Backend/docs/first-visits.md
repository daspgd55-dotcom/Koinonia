# Primera visita y notificaciones internas — v1

## Alcance y activación

Piloto para Santiago con **UTC−03:00 fijo**, no zona horaria estacional. No hay correos, push, calendarios ni reserva de cupos. Tampoco se registra automáticamente pertenencia, asistencia o acceso a experiencias.

En Administración > Comunidades > administrar ficha > Primera visita, activar «Recibir avisos de primera visita (notificaciones internas)» y guardar. `firstVisit.requestsEnabled` es opcional y false por defecto; cuentas y fichas existentes conservan sus datos. Solo representantes actualmente asignados a una comunidad activa y administradores pueden atender sus avisos. La baja o reasignación retira el acceso inmediatamente.

La ficha publicada muestra «Quiero visitar esta comunidad» en Visítanos cuando la función está activa. Permite seleccionar una reunión registrada, muestra fecha explícita, mensaje opcional (1000 caracteres) y solicitud de respuesta dentro de la aplicación. No comparte correo de acceso. Iniciar sesión conserva la selección y el mensaje en sessionStorage y vuelve a la ficha. Tras un envío correcto se limpia ese borrador.

Mis visitas está en Mi perfil y en su desplegable. Administración > Primeras visitas ofrece próximas/historial y filtro por comunidad. Notificaciones está en el desplegable de Mi perfil, con indicador de mensajes sin leer. Se actualiza al abrir la app, recuperar visibilidad, cada 60 segundos mientras esté visible y tras acciones de visita. No se requiere un servicio externo.

## Reglas de fecha y estado

- La API calcula la próxima ocurrencia **estrictamente futura** de día/hora en UTC−3, independientemente de la zona del servidor o navegador. A la hora exacta se ofrece la semana siguiente.
- Se ofrecen reuniones semanales presenciales/híbridas (o registros antiguos sin modalidad). Las reuniones Online y aquellas con notas que declaran frecuencia no semanal (mensual, quincenal, etc.) no se convierten automáticamente en fechas semanales: usar canales oficiales. Las notas semanales o informativas no bloquean opciones y se muestran al visitante. El texto libre no es un calendario de excepciones; se recomienda confirmar cualquier variación por canales oficiales.
- Se deduplican horarios equivalentes mediante una clave estable de su contenido. No se confía en índices de arreglos enviados por el cliente.
- El cliente confirma clave, fecha y versión de ficha; un cambio devuelve 409 y exige volver a seleccionar. Se guarda una instantánea de iglesia, visitante, reunión, dirección, fecha y hora. Las ediciones posteriores de la ficha no la mueven.
- Finaliza al llegar a la hora de término (duración publicada; si falta, 120 minutos). `completed` se calcula al consultar, por lo que no depende de cron.
- Estado: `sent` → `received`; `cancelled` puede originarse por el visitante o por un cambio/suspensión informado por la comunidad. Los avisos finalizados no pueden recibirse ni cancelarse.
- `attendance` es privada del visitante: unknown, attended, missed, dismissed. Solo puede declararse tras la finalización. «Ahora no» no crea nuevos recordatorios; se puede cambiar la respuesta desde el historial.
- Al consultar Mis visitas o Notificaciones se materializa **una sola** pregunta posterior por aviso finalizado. Es seguimiento interno bajo demanda, no envío programado cuando la app está cerrada. Cancelados no generan seguimiento.

## API (Bearer en todas salvo opciones)

| Método y ruta | Función |
| --- | --- |
| GET `/api/churches/:id/visit-options` | Comunidad pública; `{enabled, version, timezone, data:[{optionKey, meeting, day, time, startsAt, endsAt, address, timezone}]}`. |
| POST `/api/churches/:id/visits` | `{optionKey, startsAt, version, message?, requestReply?}`. 201; 409 si está deshabilitado, cambió horario/versión o duplicado. Límite: 15 intentos por usuario/hora. |
| GET `/api/visits/mine` | Propios; `view=upcoming|history`, `churchId?`, `page`, `limit` (máx. 50). |
| GET `/api/visits/manage` | Mismos filtros, solo comunidades autorizadas; no expone attendance ni correo. |
| PATCH `/api/visits/:id` | `{action:'cancel', version}` o `{action:'attendance', attendance:'attended'|'missed'|'dismissed', version}`. |
| PATCH `/api/visits/:id/manage` | `{action:'read'|'receive'|'change', version, message?}`. `change` exige mensaje de 5–1000 caracteres, cancela y notifica. `receive` admite respuesta personalizada. |
| GET `/api/notifications` | Paginadas, `{data, unread, pagination}`; read individual, tipo, texto, iglesia, fecha, visitId, audiencia e indicador history para abrir la sección correcta. |
| PATCH `/api/notifications/:id/read` | Marca como leída solo para el usuario autorizado actual. Idempotente. |

Los listados devuelven `pagination.total`. Los avisos devuelven `version` para concurrencia optimista; un conflicto exige recargar. Las notificaciones de recepción y cambio son respuestas dentro de la app, no mensajería general.

## Persistencia y privacidad

Colección `visits`, con eventos de notificación embebidos. Cambiar estado e insertar su evento ocurre en **una escritura atómica**: no hay una visita confirmada sin su notificación por una segunda escritura fallida. Índice único parcial `(church, visitor, optionKey, startsAt)` para avisos activos; permite volver a avisar después de cancelar. El seguimiento usa condición atómica `followupSent:false` y IDs propios por evento, evitando duplicados con consultas concurrentes.

Lectura de notificaciones por destinatario; los eventos de comunidad se autorizan mediante asignaciones vigentes, no una lista antigua copiada. Los avisos y mensajes no se incorporan a la ficha pública. No contienen correo, contraseña, ubicación personal ni preferencias del perfil. El nombre público se guarda como instantánea; si no hay nombre/usuario se muestra Visitante.

No hay borrado automático de historial en esta versión. No se ha incorporado aún una política de retención configurable, equipo de bienvenida con permisos específicos, correos ni notificaciones push.

## Cómo probar

1. Representante: habilitar recepción y guardar una ficha publicada con reunión semanal presencial.
2. Visitante: abrir Visítanos, seleccionar horario y revisar fecha UTC−3; escribir mensaje; entrar en sesión y enviar.
3. Representante: revisar Notificaciones y Administración > Primeras visitas, marcar leído y confirmar recepción con respuesta.
4. Visitante: revisar la notificación y Mis visitas; cancelar y comprobar Historial. La cancelación llega a representantes.
5. Tras el término, consultar notificaciones y responder Asistí/No pude asistir/Ahora no. La comunidad no recibe esa respuesta privada.
6. Probar con representante no asignado, usuario distinto, duplicados y versión anterior: no deben obtener acceso ni crear registros incoherentes.

Automatizado, sin producción: `cd Backend; npm test` incluye `test/visits.test.js`; `cd Frontend; npm run test:visits` usa navegador y MongoDB temporales. Cubren activación desde UI, login conservando selección, confirmación, cancelación, historial, seguimiento, aislamiento, cambios de año/semana y móvil. `npm run build` verifica compilación.
