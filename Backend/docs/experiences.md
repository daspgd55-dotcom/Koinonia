# Experiencias y Testimonios
La ficha pública muestra los relatos aprobados como comentarios dentro del último desplegable, Experiencias y Testimonios. Categorías obligatorias para nuevos envíos: long_term (Miembros antiguos, experiencia a largo plazo), new_member (Miembros Nuevos, bienvenida), youth (Jóvenes, vida de comunidad) y testimony (Testimonios). La consulta permite category opcional además de page y limit. Los relatos antiguos sin categoría se conservan y se muestran en Todas como Sin categoría; no se les atribuye una categoría automáticamente.

## Pertenencia
PUT /api/users/me/membership con {churchId:ID|null} permite asociar o quitar una iglesia publicada. La asociación es declarada por el propio usuario, única y privada; no concede permisos de representante. Se devuelve membershipChurch en el perfil propio. La interfaz permite seleccionarla en Mi perfil o en la ficha, antes de escribir. Al cambiar de iglesia se conservan las experiencias anteriores, pero solo se permiten nuevos envíos a la asociación vigente. Las cuentas antiguas quedan sin asociación hasta elegirla.

## Consulta y registro
GET /api/churches/:id/experiences devuelve únicamente aprobadas de una iglesia pública. POST en esa ruta requiere autenticación y pertenencia vigente comprobada en el servidor; {category,title,body,displayName}. Título de 5–120 caracteres, relato 40–3000, nombre público 2–60. No admite autor ni estado proporcionado por el cliente. Todos los envíos, incluso del admin, quedan pending. El correo y el identificador de autor no se publican. GET /api/churches/:id/experiences/mine devuelve solo las propias con su estado y motivo. El borrador del formulario se conserva en sessionStorage separado por usuario e iglesia.

## Moderación
GET /api/experiences/manage?status=pending|approved|rejected y PATCH /api/experiences/:id/moderation ({status,version,reason?}) requieren rol admin o representante. Admin accede a todas; representante únicamente a sus comunidades activas asignadas, comprobado tanto en listados como en cada decisión. La pertenencia personal no autoriza moderación.
Rechazar o retirar requiere motivo mínimo de 5 caracteres, visible para el autor. Las decisiones se registran en moderationLog privado y usan versión para rechazar conflictos concurrentes. Una opinión crítica no es motivo de rechazo por sí misma; se revisan respeto, pertinencia, publicidad y datos privados de terceros.
Se conserva el límite de cinco intentos de envío por hora y cuenta (memoria por proceso). No hay correos automáticos; autor y moderadores consultan los estados en la aplicación.

## Primera publicación
POST /api/churches/:id/publication-request requiere representante asignado o admin y respeta If-Match. Solo admite comunidades activas en borrador sin primera publicación. Crea publicationRequest pendiente y versiona la ficha; repetir una solicitud pendiente no la duplica. No publica automáticamente.
Administración muestra contador, filtro y aviso de solicitudes pendientes. El admin publica mediante el endpoint de estado existente y se resuelve la solicitud. Las solicitudes no se incluyen en la ficha pública. Guardar ediciones no equivale a solicitar ni publicar. No se envía email.

## Pruebas
Backend: node --test test/api.test.js. Frontend: npm run test:experiences, npm run test:publication, npm run test:manage y npm run build. Bases temporales; cubren pertenencia/cambio/baja, categorías, aislamiento entre representantes, moderación, solicitudes idempotentes, consulta pública y recorridos de navegador.
