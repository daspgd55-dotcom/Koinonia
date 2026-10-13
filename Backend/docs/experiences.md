# Experiencias y moderación
Acceso público desde la ficha de cada comunidad: #/experiencias/:churchId. Solo se consultan experiencias aprobadas de iglesias activas y publicadas. El texto es una vivencia personal, sin estrellas, puntuaciones ni clasificación de iglesias.

Usuarios autenticados de cualquier rol pueden enviar título (5–120 caracteres), relato (40–3000) y nombre público elegido (2–60). Los tres valores se recortan y validan en el servidor; no se permite enviar autor, estado o decisiones de moderación. El autor se obtiene de la sesión. El envío queda siempre pending, incluso para un administrador. El nombre público se publica por elección explícita; no se expone el correo ni el identificador del autor. Texto presentado como texto, sin interpretar HTML.

Revisión previa por administrador acordada con el usuario: pending → approved/rejected. Solo admin accede a la cola y cambia estados. El rechazo y retirada de una publicación requieren un motivo de 5–1000 caracteres que puede consultar el autor. Se permite aprobar posteriormente una experiencia rechazada. Cada decisión registra administrador, fecha, estado y motivo en moderationLog privado; version (__v) evita decisiones concurrentes obsoletas (409). Una crítica no es por sí sola motivo de rechazo: revisar pertinencia, respeto, publicidad y datos personales de terceros.

## API
- GET /api/churches/:id/experiences: públicas aprobadas.
- POST /api/churches/:id/experiences: autenticado; {title,body,displayName}; respuesta 201 pending.
- GET /api/churches/:id/experiences/mine: solo experiencias propias, incluyendo estado y motivo.
- GET /api/experiences/manage?status=pending: admin; status pending/approved/rejected.
- PATCH /api/experiences/:id/moderation: admin; {status:approved|rejected,version:entero,reason?:texto}.

Listados admiten page (desde 1) y limit (1–50, defecto 20) y devuelven pagination. Fichas no públicas devuelven 404 en consulta/envío. Límite de 5 intentos de envío por hora y cuenta con express-rate-limit (memoria por proceso, no compartido entre instancias). El borrador se conserva durante la sesión del navegador, separado por cuenta e iglesia. El registro definitivo queda en MongoDB. No hay envío de notificaciones ni edición posterior del relato en esta entrega; el autor consulta el estado en la propia página.

## Verificación
Backend: node --test test/api.test.js. Frontend: npm run test:experiences, npm run test:comparison, npm run test:saved y npm run build. Bases temporales: envío autenticado, rechazo de escalamiento, ausencia pública de pendientes/rechazadas, aislamiento de autores, moderación exclusiva admin, motivo obligatorio, conflicto de versión y retirada; navegador: fallo conservando texto, login/regreso, publicación moderada y móvil.
