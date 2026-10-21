# Amigos y mensajes — primera versión

Implementado: búsqueda por nombre de usuario, solicitudes con aceptación/rechazo/cancelación, retirada de amistad, bloqueo/desbloqueo, mensajes de texto y tarjetas de iglesias/eventos entre amigos. Disponible para cuentas autenticadas de cualquier rol, conservando las políticas existentes de sesión, MFA y verificación pausada. No envía correos.

## Nombre de usuario

El registro web solicita un nombre de usuario y consulta disponibilidad con pausa de 500 ms al escribir. Reutiliza el campo existente, reglas del perfil y el índice único: 3–24 caracteres ASCII, comienza por letra, resto letras/números/guion bajo, normalizado a minúsculas; nombres reservados no disponibles. El resultado de disponibilidad es orientativo, no una reserva. Una carrera de registros devuelve 409 `USERNAME_TAKEN` a quien pierde, sin duplicar usuarios.

La API de registro acepta `username`; sigue siendo opcional para compatibilidad con clientes anteriores y creación administrativa/invitaciones. El formulario web sí lo requiere. Las cuentas existentes no se renombran ni se bloquean: pueden elegirlo desde Mi perfil para aparecer en búsqueda. Sin username pueden conversar y enviar solicitudes, pero no se encuentran mediante el buscador.

## Contrato

Todas las rutas salvo disponibilidad requieren sesión. Respuestas `Cache-Control: no-store`.

| Ruta | Entrada / salida |
| --- | --- |
| GET `/api/usernames/availability?username=...` | `{data:{username,available}}`, sin identidad ni correo |
| GET `/api/friends/search?q=...` | Prefijo de username de 3–24 caracteres, máximo 20 resultados con id, nombre público, username, avatarUrl; excluye propia cuenta, inactivas, invitaciones pendientes y bloqueos en ambos sentidos |
| GET `/api/friends?view=friends\|requests\|history\|blocked&page=1` | Páginas de 30; `{data,page,hasMore}`; relación con id, revision, status, incoming, blocked, user y unread |
| POST `/api/friends` | `{userId}`; crea solicitud; solicitudes cruzadas no aceptan automáticamente ni duplican relación |
| PATCH `/api/friends/:id` | `{action,revision}`; action: accept, reject, cancel, remove, block, unblock. Conflicto de revisión: 409 |
| GET `/api/friends/:id/messages?before=N` | Últimos 50, ordenados ascendente, cursor nextBefore para anteriores; user, canSend y mensajes con id, sequence, mine, text, at y resource público opcional |
| POST `/api/friends/:id/messages` | `{clientId:UUID,text?:string,resource?:{type:church\|event,id}}`; exige contenido y amistad aceptada; máximo 2000 caracteres |
| POST `/api/friends/:id/read` | `{sequence}`; marca solo mensajes recibidos existentes hasta esa secuencia; nunca los recibos del otro usuario |
| GET `/api/friends/summary` | `{data:{requests,unread}}`; solicitudes recibidas pendientes y mensajes no leídos de amistades activas |

Los IDs de conversación son IDs de relación, no IDs de usuario. No se admite sender/recipient del cliente. Administradores no tienen acceso especial a conversaciones ajenas.

## Transiciones y concurrencia

Friendship tiene pareja canónica `(a,b)` única. Solo el receptor acepta/rechaza; el emisor cancela. La revisión protege cambios concurrentes. Bloquear retira la amistad y cada participante solo puede retirar su propio bloqueo. Desbloquear no restaura automáticamente la amistad. Reenviar después de rechazo, cancelación, retirada o desbloqueo espera al menos un día desde la última modificación de la relación. Retirar/bloquear conserva el historial para sus dos participantes y prohíbe nuevos mensajes.

Message es independiente de primeras visitas y eventos. Índices únicos `(sender,clientId)` y `(friendship,sequence)`. El cliente conserva un UUID al reintentar un mismo envío fallido; editar su contenido genera otro UUID. Una secuencia se asigna atómicamente al autorizar el envío, con comprobación posterior de la relación; si cambió, se elimina ese nuevo mensaje y se informa conflicto. Puede haber huecos de secuencia, sin pérdida de mensajes previos. No se requiere MongoDB con transacciones para esta versión.

Los recibos se guardan por mensaje, no solo por una última secuencia global: una inserción retrasada no queda leída por una lectura anterior. Abrir conversación marca los mensajes recibidos hasta el último cargado, sin publicar recibos ni presencia al otro usuario. Un fallo del contador no invalida mensajes guardados.

## Compartir y privacidad

«Enviar a un amigo» aparece junto a Compartir en fichas de iglesia y evento cuando hay sesión. Selecciona una amistad aceptada (lista paginada), añade texto opcional y envía una referencia interna. El servidor exige que la ficha sea pública al enviarla. Al consultar el historial vuelve a resolver su visibilidad: si fue ocultada, no entrega título ni enlace y muestra «Publicación no disponible». No se guardan copias de títulos/contactos de recursos como parte de la tarjeta. El texto libre del autor sí permanece, incluso si menciona información que después cambió.

No se exponen correo, preferencias, ubicación del usuario, listas de seguidores ni datos administrativos. Texto renderizado como texto, sin HTML ni archivos adjuntos. Los mensajes se almacenan en MongoDB y se protegen por autorización; **no tienen cifrado de extremo a extremo**. El transporte depende del HTTPS del alojamiento. No hay acceso público a historiales ni endpoint administrativo para leerlos.

Los registros no tienen borrado automático/TTL. Retirar amistad no borra una conversación compartida. Exportación, eliminación de mensajes/cuentas, política de conservación más específica y moderación/reportes de mensajería quedan pendientes antes de ampliar el uso público.

## Límites y actualización

Cuotas persistentes compartidas usando SecurityLimit y claves HMAC existentes: disponibilidad 60/min por IP; búsqueda 30/min por cuenta; solicitudes 20/h por cuenta; acciones 40/min por cuenta; intentos de envío 30/min por cuenta. No se guardan IP/correos en claro en los contadores. La confianza en proxy conserva la configuración del servidor; no se aceptan identificadores alternativos desde el navegador.

En `/#/amigos`, pestañas Amigos, Solicitudes, Historial y Bloqueados para administrar amistades. Acceso «Amigos» desde Mi perfil. El avión de papel junto a la campana abre un componente de chat flotante, fijo abajo a la derecha y renderizado en el cuerpo del documento (no iframe ni página incrustada). Conserva ventana, conversación y borradores en memoria durante navegación interna, minimización y cierre; al cerrar sesión se descartan. Los enlaces anteriores `/#/amigos?id=...` abren esa ventana. La lista presenta nombre público, avatar y mensajes pendientes; la conversación consulta cada 5 segundos solo cuando está abierta y la pestaña está visible. El contador de mensajes se actualiza cada 10 segundos y tras acciones. No hay WebSocket, push ni correo. La campana incorpora únicamente solicitudes de amistad, además de sus avisos previos; nunca mensajes. Búsqueda y administración de amigos se actualizan por acción del usuario.

## Verificación y prueba manual

- Backend: `node --test --test-concurrency=1 test/social.test.js` desde Backend.
- Navegador: `node test/social.cjs` desde Frontend. MongoDB temporal, dos sesiones ficticias y proveedores locales; sin producción ni correos.
- Compilación: `npm run build` desde Frontend.

1. Crear dos cuentas con username distintos; comprobar disponible, ocupado y reglas inválidas.
2. Buscar el segundo username desde Amigos y mensajes; enviar solicitud; aceptarla desde la otra cuenta.
3. Intercambiar mensajes; comprobar contador y lectura; compartir iglesia y evento desde sus fichas.
4. Ocultar la iglesia en datos de prueba: sus tarjetas compartidas dejan de exponer título/enlace.
5. Retirar/bloquear: no se admiten nuevos mensajes; no se pierde historial. Otra cuenta, incluso admin, recibe 404 al usar el ID de esa conversación.

Pendientes: archivos, grupos, audio/video, presencia, WebSocket, búsqueda de mensajes, cifrado extremo a extremo y herramientas de moderación específicas. No se configuran servicios externos ni se cambia la pausa de verificación.

### Resultado de esta revisión

- 22 pruebas backend aprobadas: social, correo/verificación, MFA y CAPTCHA, con bases y proveedores aislados.
- Recorrido social de navegador aprobado con dos sesiones; CAPTCHA web aprobado; compilación de producción y `git diff --check` correctos. Captura móvil revisada visualmente.
- Se actualizaron las pruebas de registro existentes para rellenar username. No se ejecutaron en esta revisión el recorrido completo `journey.cjs`, ni las regresiones adicionales `email-security.cjs`, `api.test.js` y `account.test.js`. Los tres últimos no pudieron iniciarse porque la revisión automática de permisos alcanzó su límite de uso; no fue un rechazo por inseguridad del comando.
- Sin commit, push, despliegue, datos de producción ni envíos reales.

## Solicitudes en notificaciones y ventana flotante

`GET /api/notifications` integra solicitudes recibidas pendientes con `source=friendship` y el ID de relación como ID de notificación. Solo muestra el nombre público del emisor activo. `PATCH /api/notifications/:id/read` registra requestReadAt para el destinatario, sin aceptar la solicitud. Resolver, cancelar o bloquear retira el aviso. Una nueva solicitud tras el cooldown reinicia la lectura. Se mantienen paginación, unreadOnly y conteo existentes. El enlace dirige a `/#/amigos?view=requests`.

Minimizar conserva una barra inferior; restaurar vuelve al chat. Cerrar ejecuta una transición de salida y oculta la ventana; el avión permite reabrirla. Escape cierra y devuelve foco al icono. El movimiento reducido evita las animaciones. Mientras está minimizada/cerrada no se consultan ni marcan mensajes como leídos; recibirlos incrementa el contador del avión, no el de la campana. La ventana se adapta al ancho móvil y no bloquea navegación de fondo.

Verificación del cambio a chat flotante: 9 pruebas backend (social y participación de eventos) aprobadas; recorrido de navegador actualizado aprobado con dos sesiones, lectura de solicitud desde campana, mensaje pendiente mientras se minimiza, conservación de borrador al navegar/cerrar/restaurar y botón de envío visible a 390 px. Compilación correcta y captura móvil inspeccionada. Sin cambios en servicios externos ni despliegue.
