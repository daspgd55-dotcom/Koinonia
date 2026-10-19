# Diez eventos ficticios para pruebas

Insertados en `koinonia_synthetic_test_v2` el 18-10-2026, hora de Santiago. Iglesia organizadora: **Iglesia Bíblica Alma**, la única que al preparar el lote tenía la publicación inicial autorizada necesaria. No se alteraron iglesias, representantes ni usuarios. Cada descripción identifica la publicación como ficticia; el manifiesto `test_batches/test-events-2026-10-18-v1` conserva los IDs para retirarlos de forma selectiva en el futuro.

| Fecha local | Horario local | Evento | Caso de prueba |
|---|---|---|---|
| 10-10-2026 | 10:00–12:00 | Primeros pasos en la lectura bíblica | Ya pasado, conserva ficha histórica |
| 19-10-2026 | 11:00–12:00 | Pausa de oración | Transición a pasado exactamente a las 12:00 |
| 24-10-2026 | 09:30–13:30 | Manos que acompañan | Acción social; colaboración aceptada con Iglesia Bautista Vida Nueva |
| 25-10-2026 | 16:00–18:30 | Una mesa para todos | Familias y niños; acompañamiento adulto y precaución por alergias |
| 28-10-2026 | 19:30–21:00 | Cómo leer un evangelio | En línea; inscripción; correo privado |
| 30-10-2026 | 19:00–21:00 | Voces de esperanza | Híbrido; colaboración abierta sin confirmación institucional implícita |
| 31-10-2026 | 10:00–12:30 | Esperanza para el barrio | Evangelismo presencial; condiciones de participación |
| 07-11-2026 | 09:00–17:00 | Tiempo para escucharnos | Retiro de matrimonios en la sede; por invitación |
| 14-11-2026 | 15:00–18:00 | Jóvenes con propósito | Taller con inscripción presencial; colaboración pendiente |
| 21-11-2026 | 10:00–13:00 | Encuentro deportivo | Cancelado, con motivo explícito |

## Transición del 19 de octubre

`Pausa de oración: comenzamos la semana juntos`, ID `62d66d2eff227ae0a1664cbc`, termina el **19-10-2026 a las 12:00, UTC−03:00**, equivalente a las 15:00 UTC. Antes de esa hora `displayStatus` es `scheduled`; desde esa hora es `finished`. El listado Próximos lo excluye y Pasados lo incluye al volver a consultar. Refrescar la lista o cambiar de sección: la pantalla abierta no tiene un temporizador que cambie la tarjeta al instante.

No se cambia `publicationStatus` a archivado ni `eventStatus` a cancelado. El estado temporal se calcula a partir de `effectiveEndsAt`. No hace falta cron ni una escritura programada. La participación personal tiene su propia regla: puede pasar al historial al comenzar el evento, antes de que la ficha pública pase a Pasados.

## Colaboraciones

La jornada solidaria conserva a Alma como propietaria única; **Iglesia Bautista Vida Nueva** figura como colaboradora aceptada. Se registraron invitación y aceptación simuladas con el administrador existente como actor técnico. No son acciones institucionales reales y el manifiesto las marca como simuladas. La colaboración no da permisos de edición a la invitada.

En el taller juvenil hay otra invitación a Vida Nueva en estado pendiente; no aparece como colaboración confirmada en el DTO público. `openCollaboration` en la noche de alabanza es solo invitación abierta y no equivale a aceptación.

Una primera selección apuntó a una asociación bautista; se corrigieron solo las dos relaciones de este lote para vincular una congregación local. Se respaldaron esos eventos y el manifiesto en `Backend/.cache/test-event-backups/` antes de la corrección.

## Completitud y límites de los datos

Las diez publicaciones están publicadas y tienen título, descripción, categoría, público, inicio, término, condiciones, contacto y ubicación o acceso en línea según modalidad. Los eventos presenciales usan la dirección y coordenadas existentes de Alma. Cuando la iglesia tiene una imagen, la portada identifica que es una imagen heredada de su ficha, no una fotografía de un evento ocurrido. No se crearon comunidades vinculadas ni se inventó la pertenencia a una.

Los correos, salas y formularios bajo `koinonia.test` son simulados y no permiten contacto, conexión o inscripción real. Las intenciones de participación de Koinonía se pueden probar con los ocho usuarios comunes; no se insertaron intenciones por ellos.

`verification.json` contiene conteos e IDs. `events.json` contiene los documentos insertados. En la segunda verificación `inserted: 0` significa que los diez ya existían; no hubo duplicados. Se comprobó que los diez atraviesan la consulta pública, que la colaboración aceptada se expone y la pendiente no, y que la transición temporal cumple el límite exacto. Cuatro pruebas locales adicionales cubren el esquema y la publicación, modalidades, categorías, participación, cancelación y privacidad. No se realizó un recorrido manual de Render.

El script `Backend/scripts/create-test-events.js` usa únicamente la base sintética. Al repetirlo conserva las ediciones existentes; no restablece eventos ni fechas. Una contraparte ya válida queda fijada al manifiesto.
