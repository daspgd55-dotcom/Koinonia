# Bandeja de invitaciones institucionales — etapa 4

Implementada en código; sin pruebas, build, servidor ni operaciones contra una base. No se enviaron correos ni se verificó producción.

## Sección y permisos

`#/administracion/invitaciones`, componente `ChurchOutreachAdmin.jsx`, estilos propios `ChurchOutreachAdmin.css`. Enlace visible para admin global desde Administración. La ruta muestra acceso restringido a otros roles. Todas las API usan auth + roles('admin'); ser representante de una iglesia no permite acceder a esta bandeja. Las inscripciones anteriores conservan su ruta y sus registros separados.

La bandeja agrupa cada página por iglesia, contacto y ciclo (referencia). Paginación de 20 ciclos, por lo que una iglesia puede continuar en la siguiente página. Búsqueda literal, sin ejecutar expresiones regulares del usuario, por nombre de iglesia, contacto o referencia. Filtro de entrega independiente de la etapa. Los contadores se calculan en el servidor con los mismos filtros, sobre todos los resultados, no solo la página.

Prioridad de clasificación:

1. Cerradas/no contactar: ciclo cerrado, revocado, vencido o no contacto registrado.
2. Activación: existe alguna persona aprobada. No significa que tenga acceso activo.
3. Propuestas: respuesta received o needs_clarification sin aprobaciones vigentes.
4. Esperando: enlace emitido o entrega distinta de not_sent; la UI advierte que emitir no equivale a enviar.
5. Por contactar: restantes ciclos abiertos. No incluye iglesias que todavía no tienen una invitación preparada.

## Preparación y duplicados

Selector administrativo de iglesias existentes, incluidas borradores e inactivas. Muestra fichas fusionadas pero no permite elegirlas; el backend exige una ficha disponible. Se revisan correo, nombre opcional, fuente, URL cuando corresponde, evidencia, fecha de obtención y vencimiento de hasta 90 días. Copiar un correo publicado es una acción explícita; no escribe Church.contact.

Consulta de ciclos vigentes relacionados por misma iglesia **o** mismo correo, con total y hasta 30 resultados. Si existen, el servidor requiere acknowledgeRelated=true. La exclusión por iglesia+correo se mantiene mediante índice único y transacción: reconocer la advertencia no permite duplicar ese par. Relaciones entre contactos distintos son advertencias y pueden prepararse concurrentemente; no hay exclusión total por iglesia ni por correo global. Las exclusiones de fichas fusionadas siguen pendientes antes de campañas.

## Contratos administrativos

Prefijo `/api/church-outreach-invitations`; todos los endpoints requieren admin global y no-store.

| Endpoint | Función |
| --- | --- |
| GET `/inbox?q=&stage=all&delivery=&page=1` | Bandeja, contadores y total. Omitir delivery vacío. stage: all/contact/waiting/proposals/activation/closed. |
| GET `/churches?q=&page=1` | Selector de 20 iglesias; sin filtrar por publicación/actividad. |
| GET `/related?churchId=…&email=…` | email opcional; ciclos vigentes relacionados. |
| GET `/:id` | Invitación, disponibilidad, contexto institucional y equipo actual. |
| POST `/:id/review` | Revisión con If-Match e Idempotency-Key UUID obligatorios. |

Revisión:

```json
{"action":"clarify","reason":"Motivo interno","message":"Aclaración destinada al contacto"}
```

```json
{"action":"people","reason":"Antecedentes revisados","targetFingerprint":"huella del contexto revisado","people":[{"email":"persona@example.org","state":"approved","subrole":"editor"}]}
```

```json
{"action":"reject","reason":"Motivo de rechazo"}
```

people admite 1–20 decisiones únicas sobre correos ya propuestos; state approved/rejected y subrole administrator/editor/moderator/welcome. No permite introducir correos nuevos ni usuarios desde una revisión. Si todas las personas terminan rechazadas, el ciclo se cierra con el motivo de revisión. Cada decisión conserva función propuesta y guarda función aprobada separada, motivo, fecha y actor. No prueba control del buzón ni autoridad.

Los endpoints previos de creación, actions, events y link siguen vigentes. El detalle ofrece review_target, close y no_contact con motivo; además permite emitir/renovar un enlace mediante acción explícita. La respuesta de emisión se muestra una sola vez, en memoria; no se persiste el token ni se incorpora a eventos.

## Revisión, entrega y aceptación

`review.state` registra pending/clarification/partial/approved/rejected. Por representante: reviewState, approvedSubrole, reviewReason, reviewedAt/by, acceptanceState y activationState. Estos últimos empiezan en not_requested/not_started; aprobar establece activationState=pending y mantiene acceptanceState=not_requested. La etapa 5 prepara invitaciones individuales y registra aceptación real con cuenta destinataria; no existe un botón administrativo para fingirla.

El equipo actual se muestra con funciones y actividad de cuentas. Coincidencias de correo se advierten. Ninguna operación de esta etapa modifica Church.representatives, representativeRoles, User.role ni sesiones de usuarios. No reemplaza representantes existentes. La aceptación individual y activación se implementan en la etapa 5, mediante cuenta autenticada del destinatario; el envío de correo sigue pendiente.

Una aclaración requiere motivo y mensaje. Guarda una comunicación prepared, sin envío, cambia response.state a needs_clarification, revoca accesos previos y reinicia aprobaciones pendientes. No se permite reabrir si ya hay aceptación o activación individual. Se limita a 100 comunicaciones por ciclo. El administrador puede generar otro enlace explícitamente; el acceso privado muestra la aclaración y permite volver a presentar la propuesta completa. El bloqueo de textos legales definitivos sigue aplicándose.

Rechazar la propuesta cierra el ciclo, rechaza las decisiones pendientes y revoca accesos; no se permite sobre personas ya aceptadas/activas. Cerrar exige motivo pero no retira permisos existentes. No contacto persiste la supresión iglesia+correo. Las comunicaciones, eventos y estados de entrega permanecen separados: registrar una aclaración, emitir un enlace o aprobar no cambia delivery a enviado/entregado.

## Concurrencia y borradores

Mutaciones con If-Match sobre version, transacción, bloqueo por contacto y auditoría atómica. La revisión de personas también compara la huella institucional vigente con la revisada y con la enviada por el administrador. Cambios previos de ficha/equipo obligan a revisar nuevamente. Esa comprobación no asigna accesos ni sustituye la validación transaccional que requerirá una futura activación sobre Church y User.

Los borradores viven en memoria de la sección, por ID de ciclo. Actualizar contexto conserva motivos, mensajes y decisiones; al detectar una versión/huella diferente, el administrador debe contrastarla y pulsar «Revisé los cambios; usar esta versión». No se reintenta automáticamente una escritura con otra versión. Las respuestas con error mantienen lo escrito. Volver a la bandeja conserva los borradores; recargar o salir de la sección los pierde. No hay datos personales en almacenamiento persistente del navegador.

Auditoría añade clarification_requested, people_reviewed y proposal_rejected, con motivo, actor, versión y decisiones de personas. No registra secretos. El historial se pagina de 50 en 50.

## Límites explícitos

El transporte institucional sigue sin implementar: canSend=false. No hay envíos reales disponibles ni automáticos. Cuando se integre deberá requerir una acción administrativa explícita, comprobar supresión/vigencia/destino y usar cuotas/outbox; no se debe conectar el envío como efecto de guardar o aprobar. La aceptación se registra desde la cuenta, no desde un webhook del proveedor. Los textos legales siguen pendientes y bloquean nuevas propuestas reales. La búsqueda administrativa usa lookup/regex literal sin índice especializado; medir rendimiento antes de un volumen grande.

Contratos vigentes de aprobación idempotente y aceptación: [Etapa 5](church-outreach-member-acceptance.md).

## Integración institucional, etapa 6

Plantillas, lotes explícitos, simulación y cola institucional implementados, con OUTREACH_MAIL_ENABLED=false por defecto. La activación del proveedor y las pruebas siguen pendientes. Esta etapa reemplaza las menciones anteriores a transporte institucional no implementado; no altera las políticas del piloto. Contrato vigente: [Correo institucional](church-outreach-mail.md).
