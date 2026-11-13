# Bienvenida por chat a representantes administradores

Al abrir por primera vez la ficha de administración, el frontend solicita POST /churches/:id/representative-welcome. Es una acción autenticada y limitada a 20 solicitudes por usuario por minuto; nunca se ejecuta por GET.

El servidor comprueba cuenta representante, iglesia activa, pertenencia actual con subrol administrator y una invitación institucional aceptada con acceptedSubrole administrator. También admite una invitación aceptada del flujo anterior de inscripción. No se activa para editores, moderadores, bienvenida, administradores globales ni asignaciones manuales sin invitación aceptada.

El remitente se resuelve exclusivamente en servidor por username koinonia_admin y email koinoniapp@gmail.com, exigiendo cuenta activa y rol admin. Si falta o pierde esos requisitos, no se suplanta otra cuenta ni se envía; se reintenta al abrir nuevamente la ficha.

Una transacción crea o acepta la amistad, incrementa su secuencia, guarda el mensaje y registra RepresentativeWelcome con _id igual al usuario destinatario. La clave primaria garantiza un único saludo por persona, incluso con varias iglesias o sesiones. Los mensajes conservan los índices y el contador de no leídos del chat existente. No se generan correos. Si ya son amigos se conserva la conversación; si hay bloqueo, rechazo o amistad eliminada, se registra skipped sin restablecerla. Después de enviar no se reenvía aunque se elimine la amistad o se renueve otra invitación.

El texto exacto aprobado está en Backend/src/services/representative-welcome.service.js. Este mensaje es automático y las respuestas se atienden manualmente en el chat de David. Los permisos de iglesia y controles de verificación/MFA no se cambian.

También aplica a personas que ya aceptaron una invitación antes del despliegue, cuando vuelvan a abrir la ficha, siempre que cumplan los requisitos. No hay campaña retroactiva ni ejecución al arrancar el servidor. Un fallo no bloquea el editor y permite reintentar en la siguiente entrada. No se ejecutaron pruebas, compilación, envíos reales ni despliegue durante esta implementación.
