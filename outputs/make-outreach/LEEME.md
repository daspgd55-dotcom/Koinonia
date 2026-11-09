# Koinonía → Make → Gmail

## Configurar Render
- Desplegar el backend actualizado.
- MAKE_OUTREACH_ENABLED=true (false/ausente deshabilita las tres operaciones).
- MAKE_OUTREACH_KEY_HASH: SHA-256 hexadecimal de una clave aleatoria larga elegida por ti. Make usa la clave original en X-Make-Key, Render solo su hash. No reutilices JWT_SECRET ni RESEND_API_KEY.
- Se necesitan las claves de cifrado de cola existentes y APP_PUBLIC_URL=https://koinoniapp.cl. No se consume Resend en este flujo.
- Para generar localmente clave y hash puedes ejecutar: node -e "const c=require('node:crypto'),k=c.randomBytes(32).toString('hex');console.log('Clave para Make:',k);console.log('Hash para Render:',c.createHash('sha256').update(k).digest('hex'))". No compartas la salida ni la guardes en Git.

## Importar
Crear un escenario nuevo → menú de tres puntos → Import blueprint → koinonia-gmail.blueprint.json. Asignar conexión de Gmail. Sustituir REEMPLAZAR_CLAVE_MAKE en los cuatro módulos HTTP (incluido el manejador de errores). Mantener programación desactivada para las primeras pruebas.

El blueprint utiliza el identificador de módulo Gmail v2. Si Make propone migrarlo a su versión nueva, conservar los mapeos: destinatario 2.to, asunto 2.subject, HTML 2.html, y mapear el Message ID de Gmail a providerId del módulo 5. La importación real en una cuenta Make no ha sido verificada; el JSON y los contratos se verifican localmente. Las conexiones no están incluidas.

## Flujo
1 claim: POST {} → messages (cero o un mensaje). Prepara un pendiente si existe; genera el enlace justo entonces. Reserva 10 minutos.
2 Iterator de 1.data.messages.
3 check: dispatchId y reservationToken → allowed. La autorización es de un solo uso; una segunda comprobación devuelve false.
4 Gmail solo si allowed=true. Sin CC/BCC. El manejador de error registra uncertain, nunca reenvía automáticamente.
5 result: accepted + providerId. Repetir el mismo resultado es idempotente. Si falla este paso, reintentar únicamente el módulo de confirmación, nunca Gmail.

Las reservas que vencen se convierten en uncertain al siguiente claim y no se reasignan. Un timeout de claim puede dejar una reserva sin entregar: tampoco se recupera automáticamente. Revisar Gmail antes de cualquier recuperación manual. No reejecutar módulos Gmail desde el historial ni habilitar reintentos automáticos de envío; Gmail no participa en la transacción de MongoDB y no se promete entrega exactamente una vez.

## Operaciones
Base https://david-07tv.onrender.com/api/integrations/make/outreach
POST /claim {}, /check {dispatchId,reservationToken}, /result {dispatchId,reservationToken,status,providerId?}. status accepted exige providerId; failed y uncertain registran el resultado sin reintento. La cuenta de integración no puede modificar iglesias ni representantes. 300 operaciones por hora, no es un límite diario de Gmail. Programar según la cuota del buzón. Un ciclo procesa como máximo un destinatario.

La cola debe contener exclusivamente destinatarios aprobados. Run once puede enviar un correo real: probar primero con una invitación controlada. Los enlaces son confidenciales; conservar confidential=true y evitar compartir historial de ejecución.

No se han configurado credenciales, desplegado cambios ni realizado envíos. La reserva/comprobación reduce carreras pero no puede retirar un correo si la invitación se revoca después de check y antes de Gmail. accepted significa aceptación del proveedor, no llegada a bandeja.
