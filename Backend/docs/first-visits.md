# Visitas y avisos de recepción

## Alcance y activación

Piloto para Santiago con **UTC−03:00 fijo**, no zona horaria estacional. Los avisos internos son predeterminados; los correos opcionales se describen abajo. No hay push, calendarios ni reserva de cupos. Tampoco se registra automáticamente pertenencia, asistencia o acceso a experiencias.

En Administración > Comunidades > administrar ficha > Primera visita, activar «Recibir avisos de visitas» y guardar. `firstVisit.requestsEnabled` es opcional y false por defecto; cuentas y fichas existentes conservan sus datos. Solo representantes actualmente asignados a una comunidad activa y administradores pueden atender sus avisos. La baja o reasignación retira el acceso inmediatamente.

La ficha publicada muestra «Quiero visitar esta comunidad» en Visítanos cuando la función está activa. Permite seleccionar una reunión registrada, muestra fecha explícita, mensaje opcional (1000 caracteres) y solicitud de respuesta dentro de la aplicación. No comparte correo de acceso. Iniciar sesión conserva la selección y el mensaje en sessionStorage y vuelve a la ficha. Tras un envío correcto se limpia ese borrador.

Mis visitas está en Mi perfil y en su desplegable. Administración > Visitas ofrece próximas/historial y filtro por comunidad. Notificaciones está en el desplegable de Mi perfil, con indicador de mensajes sin leer. Se actualiza al abrir la app, recuperar visibilidad, cada 60 segundos mientras esté visible y tras acciones de visita. No se requiere un servicio externo.

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

Lectura privada para el visitante y compartida para el equipo de la comunidad; los eventos de comunidad se autorizan mediante asignaciones vigentes, no una lista antigua copiada. Los avisos y mensajes no se incorporan a la ficha pública. No contienen correo, contraseña, ubicación personal ni preferencias del perfil. El nombre público se guarda como instantánea; si no hay nombre/usuario se muestra Visitante.

No hay borrado automático de historial en esta versión. No se ha incorporado aún una política de retención configurable, equipo de bienvenida con permisos específicos, correos ni notificaciones push.

## Cómo probar

1. Representante: habilitar recepción y guardar una ficha publicada con reunión semanal presencial.
2. Visitante: abrir Visítanos, seleccionar horario y revisar la fecha local (sin etiquetas técnicas); escribir mensaje; entrar en sesión y enviar.
3. Representante: revisar Notificaciones y Administración > Visitas, marcar leído y confirmar recepción con respuesta.
4. Visitante: revisar la notificación y Mis visitas; cancelar y comprobar Historial. La cancelación llega a representantes.
5. Tras el término, consultar notificaciones y responder Asistí/No pude asistir/Ahora no. La comunidad no recibe esa respuesta privada.
6. Probar con representante no asignado, usuario distinto, duplicados y versión anterior: no deben obtener acceso ni crear registros incoherentes.

Automatizado, sin producción: `cd Backend; npm test` incluye `test/visits.test.js`; `cd Frontend; npm run test:visits` usa navegador y MongoDB temporales. Cubren activación desde UI, login conservando selección, confirmación, cancelación, historial, seguimiento, aislamiento, cambios de año/semana y móvil. `npm run build` verifica compilación.


## Mejoras de visitas y reuniones

- Cada reunión admite `frequency`: `weekly`, `fortnightly`, `monthly`, `occasional`, y `visitsEnabled` booleano. Son opcionales para conservar fichas existentes. Sin frecuencia explícita se interpreta la nota como antes; sin visitsEnabled se permite. Solo reuniones semanales presenciales/híbridas habilitadas generan opciones.
- Las opciones se ordenan por tipo de reunión y luego día/hora. La frecuencia estructurada manda sobre la nota; esta queda para indicaciones. La interfaz mantiene UTC-3 internamente sin mostrar la etiqueta.
- GET `/api/visits/manage` admite `filter=all|pending|week|received` para próximas visitas. `pending` significa recepción sin confirmar, no asignación de un anfitrión. `week` incluye los próximos siete días. El historial ignora este filtro.
- La recepción registra `receivedByName` y `receivedAt`, visibles solo en administración. No asigna quién recibirá al visitante.
- PATCH `/api/visits/:id/reschedule`: autenticado propietario, cuerpo `{optionKey, startsAt, churchVersion, version}`. Solo antes de comenzar y mientras siga activo. Valida disponibilidad, versión de la ficha y del aviso; 404 para terceros, 409 para conflictos/cierre, 400 si no cambia el horario. Conserva mensaje, añade la fecha anterior a `scheduleHistory`, reinicia recepción y genera notificación a los representantes en una sola escritura. El índice único sigue evitando duplicados.
- Antes de guardar modificaciones de reuniones, administración consulta si existen avisos próximos y advierte que conservan la fecha original. El representante debe comunicar los cambios mediante Primeras visitas.
- Campana con contador y vista previa de cinco avisos; próxima visita destacada; seguimiento privado plegado al responder o elegir Ahora no.
- No hay correos, push ni asignación de equipo de bienvenida.

Prueba adicional: crea dos horarios, confirma recepción y cambia la reunión desde Mis visitas. Verifica mensaje conservado, historial anterior, recepción pendiente y notificación del cambio. Prueba filtro Sin confirmar, Recepción confirmada y Próximos 7 días. En móvil revisa campana, cierre con Escape y ausencia de desplazamiento horizontal.


### Lectura compartida de avisos
Abrir una notificación desde la campana o su enlace en Notificaciones marca el evento como leído antes de navegar. El contador se actualiza inmediatamente en esa sesión.
Marcar leído, confirmar recepción o informar cambio desde administración acusa lectura de los eventos del equipo existentes. Leer no confirma recepción: el filtro Sin confirmar sigue reflejando ese estado independiente.
Los representantes actualmente asignados y administradores comparten el estado de lectura de cada evento de comunidad. La identidad de quien lo leyó queda en readBy como auditoría; no es una lista de destinatarios. Los eventos privados del visitante mantienen su lectura individual.
Una reprogramación genera un evento nuevo no leído y reinicia recepción. No queda absorbida por lecturas anteriores. La compatibilidad interpreta los avisos antiguos ya leídos/recibidos sin reactivar la alerta inicial.
Bandeja de visitas y contador se refrescan cada 15 segundos mientras se usan, y al recuperar foco. Las listas conservan mensajes en edición. La sincronización entre sesiones no requiere volver a iniciar sesión.

### Campana y filtro de pendientes

`GET /api/notifications?unreadOnly=true&limit=5` devuelve únicamente notificaciones sin leer, filtradas antes de paginar, incluyendo visitas, eventos y colaboraciones. `pagination.total` corresponde a ese filtro; `unread` mantiene el total pendiente. `unreadOnly` acepta `true` o `false`; por defecto es `false` y conserva el historial. Se mantienen las reglas de autorización y lectura compartida del equipo. La campana usa el filtro; «Ver todas las notificaciones» abre la lista completa.


## Configuración privada del equipo y correo (2026-10-23)

La ficha editable conserva la bienvenida pública y separa **Configuración privada de avisos**. `visitSettings` se acepta en creación/actualización de iglesia y se excluye completamente de sus respuestas públicas:

```json
{"visitSettings":{"accessMode":"selected","representativeIds":["ID_ASIGNADO"],"emailEnabled":false,"emailRecipients":["bienvenida@example.org"]}}
```

- `all` es el valor predeterminado compatible con iglesias existentes. `selected` restringe Visitas a representantes seleccionados que sigan asignados y activos; lista vacía deja acceso solo al administrador. La configuración no altera permisos de edición de iglesias ni de colaboraciones. Los editores autorizados de la iglesia pueden ajustar su equipo.
- IDs ajenos/inactivos se rechazan. La lectura y atención siguen compartidas entre el equipo. `GET /api/visits/churches` devuelve solo iglesias disponibles para este panel. El servidor aplica la restricción también a listados, acciones y notificaciones.
- Nuevos avisos guardan instantáneas `visitorIdentity` y `visitorCommune`, solo expuestas al equipo en `/api/visits/manage`, junto con nombre y mensaje. Respuestas omitidas muestran “No indicada”. No se rellenan retrospectivamente avisos anteriores ni se publican datos del visitante.
- Hasta 10 correos válidos, deduplicados, que pueden no corresponder a usuarios. Desactivado por defecto. El correo solo anuncia un nuevo aviso para la iglesia y enlaza al panel: no incluye nombre, identidad espiritual, comuna ni mensaje del visitante. El formulario informa al visitante de los datos compartidos con el equipo.
- Reutiliza el proveedor y límites existentes. Sin proveedor el aviso interno se conserva y el panel informa indisponibilidad. En modo directo no se reintenta automáticamente un fallo/timeout; “aceptado” no significa entregado. Las reprogramaciones y cancelaciones mantienen sus avisos internos, sin nuevos correos externos.
- Si está activada la cola existente, el outbox cifrado se guarda atómicamente dentro de Visit. El worker reconcilia outboxes de User y Visit, con deduplicación, vencimiento y reintentos existentes. Un worker suspendido no entrega hasta reanudarse; no hay fallback directo. Cambiar destinatarios o desactivar correos no revoca trabajos previamente encolados. Consultar la documentación de cola para sus claves y activación; no hace falta otra API key.

### Comprobación aislada
`node --test Backend/test/visits.test.js Backend/test/linked-communities.test.js Backend/test/mail-queue.test.js Backend/test/event-collaboration.test.js`

`node Frontend/test/visits.cjs` verifica recepción, notificaciones, lectura, cambios de reunión, cancelación, historial y privacidad. Las pruebas de correo usan adaptadores simulados; no envían correos reales. Para revisión manual, elegir un equipo parcial, enviar un aviso con otro usuario y verificar que el representante excluido no puede consultarlo ni recibe notificación; el admin conserva acceso.
