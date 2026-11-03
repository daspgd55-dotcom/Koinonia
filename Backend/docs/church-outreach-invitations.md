# Invitaciones a iglesias existentes — base del flujo

Estado: etapas 1, 2, 3, 4 y 5 implementadas en código, sin pruebas ni ejecución contra bases de datos. No se enviaron correos, no se ejecutó el backend y no se cambiaron políticas ni credenciales. No se verificó producción.

## Propósito y separación

ChurchOutreachInvitation prepara una invitación institucional dirigida a una iglesia que ya existe. No es una inscripción pública, una verificación institucional ni una asignación de representante. No crea Church ni User y no modifica sus documentos. Tampoco altera ChurchRegistrationRequest, sus registros, enlaces, rutas o interfaz.

El contacto inicial puede ser un buzón compartido y quien responda puede limitarse a coordinar. `recipient` no es un representante obligatorio. `response.respondent` y `proposedRepresentatives` son estructuras separadas para etapas siguientes. No se copia automáticamente al contacto inicial dentro del equipo ni se le asigna `administrator`.

Se reutilizan autenticación/roles actuales, validación Zod, errores HTTP, If-Match obligatorio y transacciones Mongoose. No se reutiliza el servicio de inscripción que exige al solicitante como administrador. No se integra todavía esta colección al reconciliador de correo ni al webhook; esos sistemas no interpretan estas invitaciones como trabajos de envío.

## Entidades

### ChurchOutreachInvitation

- `_id`, referencia aleatoria única, `createdAt`, `updatedAt` y `version` inicial 1.
- `church`: referencia obligatoria e inmutable. La API comprueba que existe antes de guardar; una referencia Mongoose no equivale a una clave foránea.
- `recipient.email`: obligatorio, normalizado y fijo. `recipient.name`: opcional. No acepta un usuario ni un rol como destinatario.
- `contactSource`: tipo, URL cuando corresponde, fecha de obtención, evidencia y administrador que registró el dato. Tipos: institutional_website, institutional_social, direct_contact, administrative_record. Web y redes requieren URL HTTP(S). Registrar procedencia no confirma control del buzón ni autoridad.
- `purpose`: church_profile_enrichment, fijado por servidor.
- `createdBy`, `updatedBy`: administradores obtenidos de la sesión, nunca del cuerpo HTTP.
- `lifecycle`: vigencia/preparación; `active` mantiene la exclusión de ciclos simultáneos.
- `expiresAt`: fecha explícita futura, máximo 90 días desde preparación. Es el límite del ciclo, también limita la duración máxima de enlaces y sesiones.
- `delivery`: estado de entrega, fecha, intentos y espacio para referencia de proveedor; nace not_sent, intentos 0.
- `response`: estado de respuesta, persona que responde, comentarios y fecha; nace awaiting_response. La sesión privada permite registrar interés o una respuesta de retirada/corrección.
- `proposedRepresentatives`: nombres, correos, subroles propuestos y posible referencia futura a User. Vacío al preparar; máximo 20 sin correos repetidos. El mismo correo puede coincidir con recipient. No hay asignaciones efectivas.
- `targetReview`: estado, huella del destino revisado, versión de iglesia, nombre, actividad, cantidad de representantes, administrador, fecha y motivo.
- `revokedAt`, `revokedBy`, `revocationReason`, `closedAt`, `noContact` y nota administrativa opcional.

El índice único parcial por church + recipient.email con active=true impide dos ciclos vigentes del mismo par. No impide contactar distintos buzones de una iglesia; la futura bandeja deberá mostrar esos ciclos relacionados antes de preparar campañas.

### ChurchOutreachEvent

Historial separado, con referencia a invitación, actor, acción, fecha, versión, estados anterior/nuevo y motivo. La mutación y su evento se guardan en la misma transacción. No existe API de edición/borrado de eventos. Las transiciones de esta etapa son created, target_reviewed, expired, revoked, closed y no_contact_recorded.

### ChurchOutreachContact

Registro persistente de no contacto y bloqueo transaccional, identificado por hash de church + correo normalizado. Evita que cerrar una invitación o abrir otro ciclo borre la preferencia. `no_contact` sobre una invitación histórica revoca también el ciclo activo del mismo par. No se ofrece una operación para levantar la supresión en esta etapa.

El alcance de esta supresión es esta iglesia y correo dentro del nuevo flujo. No es una baja global de todos los servicios de Koinonía ni una revocación de permisos. No se propaga automáticamente entre IDs de iglesias fusionadas: antes de una campaña habrá que resolver esas identidades y sus exclusiones; por ahora no existe capacidad de enviar. Los hashes de acceso no se exportan por las API.

## Estados operativos y transiciones

| Estado de vigencia | Operaciones permitidas | Resultado |
|---|---|---|
| draft | review_target, expire si venció, revoke, close, no_contact | ready, expired, revoked o closed |
| ready | review_target, expire si venció, revoke, close, no_contact | ready, expired, revoked o closed |
| expired | revoke, close, no_contact | revoked o closed |
| revoked | no_contact para registrar una preferencia posterior | permanece revoked |
| closed | no_contact para registrar una preferencia posterior | permanece closed |

Todas las operaciones expuestas requieren admin global y motivo. No hay reapertura ni extensión silenciosa; se prepara otro ciclo cuando el anterior dejó de estar activo y no existe no contacto.

La fecha de vencimiento se aplica al consultar: `effectiveLifecycle=expired` aunque aún no se haya materializado el estado almacenado. GET no escribe. `expire` lo materializa con auditoría; preparar otro ciclo del mismo par también materializa el vencimiento del previo en la misma transacción. No hay cron ni TTL que borre invitaciones.

ready significa que un administrador revisó el destino, no que se haya enviado correo. Cambios en Church dejan `requiresTargetReview=true` y `preparationReady=false` en el detalle, aunque el último lifecycle persistido sea ready. Consultar no altera el historial.

`readiness.canSend` es siempre false en esta etapa. La vigencia, no contacto y revisión deben volver a comprobarse al emitir, iniciar y responder; el futuro envío también deberá comprobarlas; no se debe confiar en una respuesta GET anterior.

### Estados previstos y activación por etapas

| Dominio | Contrato previsto | Responsable futuro |
|---|---|---|
| Entrega | not_sent → queued → accepted → delivered; queued puede fallar/cancelarse; accepted puede terminar en bounced; failed puede reintentarse con límites | Cola/proveedor con evidencia, no un selector del navegador |
| Respuesta | awaiting_response → received / declined / wrong_church / wrong_contact; received → needs_clarification / approved / rejected; needs_clarification → received; cierre explícito → closed | Destinatario autenticado por invitación y admin según operación |
| Equipo | Propuesta → decisión individual → invitación individual → aceptación y asignación | Próximas etapas de revisión y equipos |

Los enums de entrega/respuesta reservan vocabulario, pero no implementan esos recorridos. En esta etapa solo close establece response.state=closed; ninguna ruta permite fingir recepción, entrega, aprobación o aceptación.

## Destino, fusiones, inactividad y equipos

- No hay PATCH de church ni recipient.email y los esquemas de entrada rechazan esos campos en acciones. Corregir un destinatario exige revocar/cerrar y preparar otra invitación, conservando procedencia.
- No se prepara una invitación sobre una ficha ya fusionada. El detalle de una invitación cuyo destino fue fusionado informa la ficha principal sugerida, sin cambiar el enlace original ni su iglesia. Detecta ciclos, referencias rotas y cadenas excesivas.
- Para cambiar el destino, el admin debe revocar/cerrar la invitación anterior y crear otra para la ficha correcta. Nadie puede redirigir el acceso de un destinatario sin esa revisión.
- La huella incluye identificación, ubicación, actividad, metadatos, versión/fecha de Church y equipo con subroles. Cualquier cambio relevante respecto a esa huella exige revisión explícita.
- Para revisar una iglesia inactiva se exige acknowledgeInactive=true y motivo. No se restaura ni se publica.
- Para revisar una iglesia con representantes se exige acknowledgeExistingTeam=true. No se sustituye ni promociona a nadie. Los subroles históricos se interpretan igual que el contrato actual para describir el contexto, no para crear asignaciones.
- Una iglesia eliminada o una fusión inconsistente bloquean la preparación. La futura aprobación también deberá comprobar de nuevo el destino y equipo dentro de su operación.

## API administrativa implementada

Todas las rutas bajo `/api/church-outreach-invitations`, con auth + roles('admin') y Cache-Control: no-store. El acceso privado de etapa 2 se documenta en [church-outreach-private-access.md](church-outreach-private-access.md).

| Método/ruta | Uso |
|---|---|
| POST / | Preparar invitación; devuelve 201 y ETag de versión |
| GET / | Listar por churchId y lifecycle, page>=1, limit 1–50 (20 por defecto) |
| GET /:id | Detalle, estado actual del destino y readiness; ETag |
| GET /:id/events | Historial paginado; limit 1–100 (50 por defecto) |
| POST /:id/actions | review_target, expire, revoke, close o no_contact |

Ejemplo conceptual del cuerpo de preparación (fechas futuras elegidas por admin):

```json
{
  "churchId": "ObjectId de una iglesia existente",
  "recipient": {"email": "contacto@example.test", "name": "Secretaría"},
  "contactSource": {
    "kind": "direct_contact",
    "collectedAt": "fecha ISO con zona horaria",
    "evidence": "Cómo se obtuvo y comprobó el canal institucional"
  },
  "expiresAt": "fecha ISO futura, no más de 90 días",
  "note": "Nota interna opcional"
}
```

Las acciones requieren `If-Match: "1"` (versión actual). Cuerpo de revisión:

```json
{
  "action": "review_target",
  "reason": "Antecedentes revisados por el administrador",
  "acknowledgeInactive": false,
  "acknowledgeExistingTeam": true
}
```

Errores: 400 validación/fechas; 401 sesión; 403 permisos; 404 inexistente; 409 concurrencia, duplicado, no contacto, destino o transición no permitidos; 428 ausencia de versión. MongoDB standalone no soporta estas transacciones; requiere replica set igual que la gestión actual de equipos, sin fallback parcial.

## Compatibilidad y trabajo pendiente

La inscripción anterior sigue disponible sin migración ni modificaciones. Los nuevos modelos se inicializan en el arranque normal del backend; no se arrancó ni migró una base durante esta implementación. Church, User, los contratos de equipos y la cola permanecen sin escrituras desde este flujo.

Pendientes expresos: textos legales definitivos para habilitar el formulario; entrega de invitaciones individuales; plantillas; outbox; webhooks; lotes; recordatorios; exclusiones globales y por identidad fusionada; términos definitivos; política de retención; manual. La existencia de campos no implica que esos mecanismos estén activos. El límite de 90 días corresponde a vigencia y no a retención de datos.

No se ejecutaron pruebas, comprobaciones de sintaxis, build ni llamadas HTTP. La revisión fue por lectura de archivos. No se afirma compatibilidad verificada en ejecución, entrega de correo ni habilitación en Render.

La etapa 2 habilita received como interés, wrong_church, wrong_contact, declined y no contacto desde sesión privada. La etapa 3 incorpora el formulario de representantes con recepción bloqueada hasta configurar textos legales definitivos. La aprobación sigue pendiente. Contratos, cuotas y límites: [Acceso privado institucional](church-outreach-private-access.md).

Interfaz y consentimiento de etapa 3: [Respuesta institucional](church-outreach-response-ui.md).

Bandeja y revisión administrativa: [Etapa 4](church-outreach-admin.md).

Aceptación y asignación transaccional: [Etapa 5](church-outreach-member-acceptance.md).

## Integración institucional, etapa 6

Plantillas, lotes explícitos, simulación y cola institucional implementados, con OUTREACH_MAIL_ENABLED=false por defecto. La activación del proveedor y las pruebas siguen pendientes. Esta etapa reemplaza las menciones anteriores a transporte institucional no implementado; no altera las políticas del piloto. Contrato vigente: [Correo institucional](church-outreach-mail.md).
