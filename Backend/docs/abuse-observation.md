# Observación de abuso distribuido (piloto)

`ADVANCED_ABUSE_MODE=observe` es el predeterminado nuevo. `off` desactiva solo estas señales; `enforce` rechaza el arranque porque la aplicación directa de bloqueos de abuso avanzado sigue reservada. `EMAIL_VERIFICATION_REQUIRED=false` continúa en pausa. No se modifican cuentas, sesiones, contraseñas provisionales ni invitaciones.

## Alcance y decisiones

POST de login, registro, recuperación/cambio de contraseña, verificación, invitaciones y MFA se observan antes de las cuotas existentes. Rutas desconocidas y GET no crean contadores. Se agrega cada intento, no solamente los fallidos: las señales expresan volumen, no culpabilidad. La identidad declarada se normaliza con trim/minúsculas; nunca se eliminan puntos ni sufijos `+`. Operaciones sin correo tienen solamente fuente, operación y global; los límites MFA existentes conservan su protección por cuenta/desafío.

Cada ventana fija de 15 minutos combina: identificador por operación (>30), fuente por operación (>120), operación (>1000) y global de operaciones observadas (>3000). Una cuenta recibe todos los intentos aunque roten IP. Una fuente recibe todos los intentos aunque cambien cuentas. Fuente sola sugiere `monitor` para proteger redes compartidas; las otras señales sugieren `captcha`, nunca un bloqueo en esta versión. No hay bloqueos permanentes ni modificaciones de usuarios. Estos umbrales iniciales requieren calibración con tráfico real antes de implementar desafíos.

`res.locals.abuseRisk` contiene action/reasons/observed para la integración interna CAPTCHA (ver adaptive-captcha.md). No es una API pública ni se acepta desde el navegador. Los rechazos RATE_LIMIT de cuotas existentes siguen siendo reales e independientes. Los registros `abuse_observation` indican `enforced:false` y solo se emiten al cruzar un umbral, una vez por contador/ventana entre instancias. No representan rechazos ni prueban ataques. Un fallo del registro no afecta la solicitud.

## Persistencia, precisión y fallos

AbuseCounter reutiliza el patrón MongoDB de SecurityLimit, en colección separada. Incrementos/upserts son atómicos, comparten `_id` entre instancias y reintentan colisiones de creación. Índice TTL; las ventanas se restablecen por lógica aunque TTL aún no haya borrado el documento. Escrituras tardías no retroceden una ventana. Todas las instancias deben mantener relojes sincronizados y el mismo JWT_SECRET.

Para acotar cardinalidad, HMAC-SHA256 con separación de dominio mapea identificador y fuente a 2048 casillas por operación. No se almacenan ni siquiera hashes completos de correos/IP: solo casilla, operación, ventana, cuenta y vencimiento. Con 12 operaciones el máximo es 49165 documentos, incluso si TTL se retrasa. Colisiones pueden sobreestimar; no se calculan cantidades exactas de personas, IP únicas ni cuentas únicas. Rotar el secreto cambia agrupaciones transitoriamente. No hay huella de dispositivo. Los límites SecurityLimit existentes conservan su almacenamiento y semántica anteriores; su cardinalidad no queda limitada por esta nueva colección.

La observación espera como máximo 350 ms, Mongo aplica maxTimeMS 250 ms, sin buffering Mongoose, y se limita a 256 operaciones pendientes por proceso. Saturación/fallo devuelve `unknown`, nunca `allow` como evidencia de salud ni añade rechazo. Se registra `abuse_observation_unavailable` como máximo una vez/minuto/proceso, sin excepciones ni datos de petición. El trabajo ya enviado puede terminar después del plazo. Las cuotas existentes mantienen su manejo previo de fallos (pueden impedir una operación); no se promete acceso cuando MongoDB está caído. Los logs son señales muestreadas, no un sistema completo de métricas o alertas.

## IP y proxies

Sin configuración, Express usa el socket e ignora X-Forwarded-For. IPv4 mapeada en IPv6 se normaliza; IPv6 se agrupa por /56 para impedir rotación trivial de direcciones. `TRUST_PROXY_CIDRS` permite lista explícita de redes de proxies confiables, validada al iniciar. No combinar con TRUST_PROXY_HOPS. Express recorre la cadena desde el proxy inmediato y se detiene al encontrar un origen no confiable.

Se conserva TRUST_PROXY_HOPS por compatibilidad: úsalo únicamente si la infraestructura garantiza esa cantidad de saltos, bloquea acceso directo al origen y el proxy sobrescribe cabeceras. En topologías con rutas más cortas, confiar por saltos permite suplantar IP: preferir CIDRs de proxies reales. No se configuró Render ni firewall automáticamente. Los límites heredados continúan usando req.ip sin cambiar umbrales; normalización /56 se aplica a las señales nuevas.

## Límites de cobertura y pruebas

Esto protege operaciones de aplicación; no detiene saturación del enlace, TLS, conexiones, cuerpo HTTP ni ataques distribuidos de gran volumen antes de Express. Requiere protección externa (proxy/WAF/CDN, límites en borde, firewall del origen, supervisión de recursos) para ese alcance. No se contrató ningún servicio. No equivale a una cuenta por persona.

Ejecutar desde Backend: `node --test --test-concurrency=1 test/abuse-risk.test.js test/security-policy.test.js test/verification-pause.test.js test/email-security.test.js test/mfa.test.js`. MongoMemoryServer usa base temporal y correos simulados. Incluye dos conexiones independientes, concurrencia, rotación IP, red compartida, límites globales, TTL, fallos/plazos y proxy. No es una prueba de carga de infraestructura ni un despliegue multi-región.
