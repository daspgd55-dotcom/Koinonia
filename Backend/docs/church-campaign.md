# Preparación de convocatoria Make

En Importar contactos, seleccionar lotes del historial (últimos 20), revisar destinatarios y confirmar selección. POST /api/church-campaigns/preview recibe imports (IDs); POST /prepare añade digest, keys y reviewed. Ambas rutas requieren administrador global. La lista deduplica iglesia+correo; conserva procedencias y excluye correo inválido, ficha ausente/fusionada, datos de prueba, contactos suprimidos e invitaciones previas. Los ciclos previos se revisan por separado: no se renuevan ni reasignan automáticamente.

La confirmación transaccional crea invitaciones listas con initialChannel=make inmutable y revisión del destino. Repetir una confirmación antigua devuelve conflicto sin duplicar. No genera tokens, trabajos de correo ni permisos. Resend rechaza selecciones institucionales de este canal; los mensajes de representantes no se bloquean por él. Los campos históricos sin canal conservan el comportamiento anterior.

Pendiente: cola/reservas Make, autenticación de integración, entrega de payloads, resultados, renovación, blueprint y envíos. No hay endpoint público ni credenciales Make en esta etapa. Caducidad de invitación: 30 días desde preparación; no preparar campañas con demasiada anticipación.
