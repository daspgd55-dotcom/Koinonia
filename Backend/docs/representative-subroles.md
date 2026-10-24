# Equipo de representantes por iglesia

Implementado en backend y administración web. No cambia los roles globales `user`, `representative` y `admin`, ni las políticas de seguridad del piloto.

## Funciones

| Subrol por iglesia | Ficha, imágenes y configuración de iglesia | Comunidades y eventos, incluidas colaboraciones | Experiencias | Visitas | Equipo |
| --- | --- | --- | --- | --- | --- |
| `administrator` | Sí | Sí | Sí | Sí* | Asigna usuarios existentes a editor, moderador o bienvenida |
| `moderator` | No | No | Sí | Sí* | No |
| `editor` | No | Sí | No | No | No |
| `welcome` | No | No | No | Sí* | No |

El administrador global conserva todas las funciones y es el único que asigna, sustituye o retira representantes administradores. Los responsables informativos del perfil no obtienen permisos.

*Se conserva también la selección privada de encargados de Visitas: si la iglesia tiene acceso limitado a personas seleccionadas, el usuario debe cumplir ambas condiciones. Un editor no gana acceso por estar en esa lista. El administrador global mantiene acceso. Los correos externos de avisos no adquieren permisos de aplicación.

Una persona puede ser administradora en una iglesia y editora en otra: las asignaciones no se propagan. La membresía, amistad y seguimiento no conceden acceso administrativo.

## Compatibilidad y persistencia

`Church.representatives` conserva las asociaciones. `Church.representativeRoles` almacena `{user,subrole}`. Una asociación histórica sin entrada explícita se interpreta como `administrator`, conservando el acceso previo; no se migran ni borran datos. Nuevas asignaciones de equipo guardan siempre el subrol explícito. El endpoint administrativo anterior conserva subroles existentes y asigna administrador a nuevas asociaciones.

El equipo se modifica con versión y transacción MongoDB que incluye la promoción de `user` a `representative`. Requiere replica set (por ejemplo Atlas); un MongoDB standalone no permite esta operación. No hay fallback parcial. Las pruebas usan MongoMemoryReplSet. Una promoción incrementa `sessionVersion`: el usuario debe iniciar sesión de nuevo. Cambiar o retirar un subrol se aplica a las siguientes solicitudes mediante consulta de permisos vigentes. No se degrada el rol global al retirar una iglesia, pues puede haber otras asignaciones.

Máximo 20 representantes por iglesia. Debe quedar al menos una asignación administradora; este control no garantiza que la cuenta esté activa: el administrador global puede reemplazar una cuenta desactivada. `teamAudit` conserva las últimas 200 acciones con actor y fecha, sin publicación de estos datos. El reemplazo administrativo legado registra la acción de reemplazo; el endpoint de equipo registra además usuario y subrol.

## API

Todas las rutas bajo `/api`, autenticadas; ningún parámetro del navegador concede permisos.

- `GET /churches/management-permissions`: unión de funciones administrativas vigentes para orientar la navegación; no sustituye autorización por iglesia.
- `GET /churches/:id/team`: solo administrador global o representante administrador asignado. Responde `{version,data:[{_id,name,username,email,role,active,subrole}]}`.
- `GET /churches/:id/team/lookup?identifier=...`: búsqueda exacta por correo o nombre de usuario activo; mismos permisos. Devuelve datos mínimos o `null`. No crea cuentas.
- `PUT /churches/:id/team`: `If-Match: "<version>"`, cuerpo `{userId,subrole}`. Valores `administrator`, `moderator`, `editor`, `welcome`, `remove`. Devuelve equipo actualizado. `403` función insuficiente; `409 STALE_VERSION` conflicto; `409 LAST_ADMIN` si no queda administrador; `400` datos inválidos o límite.
- Consultas de iglesias administrables incluyen `permissions`. Los subroles sin edición de ficha reciben contexto reducido sin equipo, auditoría, ajustes privados de visitas ni datos ocultos.
- Los endpoints existentes de comunidades, eventos, medios, moderación, visitas y notificaciones comprueban la función correspondiente. Los colaboradores de eventos no reciben permisos de edición ajenos.

## Uso y comprobaciones

En Administración → iglesia → **Gestionar equipo y subroles**, buscar una cuenta existente y asignarle una función. Los representantes administradores no crean cuentas; la creación/invitación administrativa previa permanece disponible solo para admin global, con contraseña provisional opcional según la política vigente.

Ejemplo: Ana administra Iglesia A y asigna a Luis como editor. Luis puede publicar eventos de A cuando se cumplen las reglas de publicación, pero no modificar su ficha, aprobar testimonios ni leer avisos privados de visitas. Ser editor de A no concede ningún acceso a B.

Pruebas aisladas, sin producción ni correos reales:

```powershell
node --test Backend/test/church-subroles.test.js Backend/test/linked-communities.test.js Backend/test/events.test.js Backend/test/visits.test.js Backend/test/event-collaboration.test.js
node Frontend/test/church-subroles.cjs
npm --prefix Frontend run build
```

Cubren compatibilidad histórica, aislamiento, contexto privado, asignación de usuario existente, elevación prohibida, conflicto concurrente, revocación, moderación, eventos, conteos, avisos y privacidad pública. La prueba de navegador recorre representante administrador, editor y administrador global, comprueba el equipo a 390px y conserva el formulario de iglesia fuera del alcance del editor.

Limitaciones: una función por persona e iglesia; no hay roles personalizados, asignaciones por comunidad individual ni permisos compartidos entre iglesias. No se envían correos por asignar subroles. El historial interno es limitado, no un archivo de auditoría permanente. La interfaz que ya estaba abierta puede requerir recarga para reflejar cambios hechos por otro administrador; las nuevas peticiones quedan sujetas a los permisos vigentes.
