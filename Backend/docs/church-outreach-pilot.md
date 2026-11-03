# Piloto pequeño de invitaciones dirigidas

Estado: preparado para revisión, **sin envío**. No hay lote creado en producción. La vista previa generada utiliza una iglesia y un correo ficticios; sus identificadores pertenecen a una base temporal ya eliminada.

## Alcance propuesto

Seleccionar manualmente **3 iglesias existentes** y un contacto institucional comprobado por iglesia. Incluir una ficha borrador y, si existe un caso adecuado, una con equipo previo. No usar contactos sintéticos, inferidos o marcados como prueba. La persona destinataria puede coordinar sin ser representante.

Antes de cualquier envío futuro deben existir textos definitivos versionados de términos y privacidad, procedencia vigente del contacto, revisión del destino y una decisión explícita de habilitar el transporte/cola del flujo. Este trabajo no cambia políticas del piloto ni credenciales. El enlace al manual permanece omitido mientras no exista.

## Preparación revisable

1. Entrar como administrador global a «Invitaciones a iglesias». Preparar cada ciclo seleccionando una Church existente; comprobar nombre, comuna, actividad, posibles fusiones y equipo actual.
2. Revisar correo y procedencia: fuente, fecha y evidencia. No sobrescribir el correo publicado. Consultar ciclos relacionados y exclusiones por no contacto o rebote permanente. Resolver duplicados antes de seguir.
3. Guardar sin enviar. Confirmar revisión del destino, incluyendo inactividad/equipo cuando corresponda. Si cambió la ficha, volver a revisar; nunca elegir otro destino desde el formulario del destinatario.
4. Seleccionar explícitamente los tres contactos en «Correos y lotes». Ver correos y exclusiones. Revisar destinatario, iglesia, finalidad, instrucciones, retiro y enlace personal sustituido por marcador en la vista previa.
5. Guardar el lote preparado y simular con el estado actual. Conservar fecha, versión/digest, exclusiones y copia de los textos para revisión. **Detenerse aquí; no pulsar Confirmar encolado.** Un lote preparado no es una campaña activa.

| Fila a completar por admin | Iglesia/ID | Contacto y evidencia | Equipo actual | Exclusiones | Decisión |
| --- | --- | --- | --- | --- | --- |
| 1 | Pendiente | Pendiente | Pendiente | Pendiente | Sin enviar |
| 2 | Pendiente | Pendiente | Pendiente | Pendiente | Sin enviar |
| 3 | Pendiente | Pendiente | Pendiente | Pendiente | Sin enviar |

Ejemplo técnico ya revisable: `outputs/invitaciones-verificacion/vista-previa-sintetica.json`. Muestra asunto y cuerpo completos de una invitación inicial a «QA Pilot · Vista previa ficticia», para `pilot@example.test`. No es una selección de iglesias reales.

## Seguimiento después de una autorización futura

Separar en la bandeja entrega, respuesta, revisión y aceptación individual. Una aceptación del proveedor no prueba entrega y una apertura no prueba respuesta. Registrar errores de contacto/no contacto y detener nuevas comunicaciones relacionadas. No activar recordatorios automáticos: revisar manualmente elegibilidad, límite de dos y plazo mínimo antes de preparar otro lote.

Revisar cada persona y función con motivo. Mantener los representantes anteriores; no publicar, restaurar ni verificar la iglesia como consecuencia de la aprobación. Para equipos nuevos, aceptar primero una persona administradora válida. Preparar después los correos individuales, también con vista previa y acción explícita. Cada persona debe usar su cuenta del correo destinatario, con las políticas de verificación y MFA vigentes.

Evaluar el piloto por respuestas válidas, errores de contacto, solicitudes de retiro, incidencias de aceptación y campos efectivamente enriquecidos. No usar aperturas como indicador de autoridad ni éxito. Ante destino incorrecto o permisos inesperados, revocar el ciclo y detener el lote pendiente para revisar.

La inscripción anterior sigue disponible por su ruta directa y en administración, pero el inicio público ya orienta al piloto dirigido. No se migra ni elimina su información.
