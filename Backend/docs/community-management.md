# Administración de comunidades

Las fichas de este documento corresponden a iglesias. La entidad independiente de grupos y ministerios asociados se documenta en [Comunidades vinculadas: contrato de backend](linked-communities.md); sus endpoints son `/api/communities` y no sustituyen `/api/churches`.

Panel React: `http://127.0.0.1:5173/#/administracion`. El enlace Administración aparece para `representative` y `admin`. La API consulta el rol vigente en MongoDB en cada solicitud; el navegador no concede permisos.

## Permisos

| Acción | Representante | Administrador |
| --- | --- | --- |
| Listar y consultar fichas privadas | Solo asignadas, incluidas inactivas | Todas |
| Editar ficha activa | Solo asignadas | Todas |
| Crear | No | Sí, inicialmente borrador |
| Publicar / pasar a borrador | Solo asignadas con primera publicación previa del admin | Sí |
| Verificar, asignar representantes | No | Sí |
| Dar de baja y restaurar | No | Sí |

La eliminación usa `active=false`, conserva relaciones y datos, y exige confirmación en pantalla. Restaurar vuelve a borrador. Una ficha fusionada no se restaura. No hay borrado físico desde este panel. Un usuario común recibe 403 en los endpoints privados aunque invoque la API directamente.

## Atributos del formulario

Base: `Ficha Iglesia - Formularios de Google.pdf`, 21 páginas. Se reutilizan los grupos del modelo existente:

- `identification`: nombre, abreviación, año, descripción y rasgos distintivos.
- `verification`: nombre y cargo del informante, autorización declarada, fuente. La fecha la determina el servidor; estos datos del informante no son públicos. Autorizar el uso de información no asigna permisos de cuenta.
- `location`: dirección, comuna, ciudad, región, código postal, punto público en mapa, accesibilidad, estacionamiento e indicaciones. El mapa permite marcar el lugar; coordenadas verificadas son alternativa si falla la cartografía. No obtiene GPS personal ni geocodifica automáticamente la dirección.
- `christianIdentity`: rama, denominación, tradición, red e idiomas. Catálogos con valores libres para conservar opciones históricas.
- `doctrine`: declaración, características, soteriología y escatología.
- `meetings`: reuniones repetibles con tipo, audiencia, modalidad, dirección/enlace, varios horarios y notas de frecuencia. Duración en minutos opcional; si se informa debe ser un entero entre 1 y 1440. No inventar horarios para completar una ficha.
- `community`: rango de miembros, ministerios, actividades, edades y descripción.
- `leadership` y `contact`: responsable principal, otros responsables, canales institucionales.
- `firstVisit`: indicaciones, apoyo y proceso de bienvenida.
- `media`: URLs HTTP(S) de imágenes/videos, título y fuente. No incluye carga de archivos ni descarga automática.

El correo inicial del Forms no se convierte automáticamente en correo institucional: el usuario autenticado ya identifica a quien edita; `contact.email` corresponde al contacto público declarado de la iglesia.

### Extensiones compatibles

- `location.parkingAvailability`: `yes | no | nearby | unknown`.
- `location.accessibilityLevel`: `yes | no | partial | unknown`.
- `firstVisit.welcomeSupport`: `yes | no | partial | unknown`.
- `meetings[].frequencyNotes`: texto hasta 10000 caracteres.

Todos opcionales. No requieren borrar ni migrar documentos existentes. La interfaz deriva sí/no desde los booleanos antiguos al abrir una ficha. En escrituras con nuevos campos, el servidor sincroniza el booleano para `yes/no` y lo omite para `partial/nearby/unknown`, evitando presentar lo parcial como confirmado. Los valores legados no visibles y los grupos de otras secciones se conservan en el borrador; importación, permisos y metadatos técnicos permanecen fuera del PUT editable.

## API

Se reutilizan `GET /churches/manage`, `GET /churches/manage/:id`, `POST /churches`, `PUT /churches/:id`, `DELETE /churches/:id`, `POST /churches/:id/restore`, `PATCH /churches/:id/status` y `PUT /churches/:id/representatives` bajo `/api`.

Cambio de autorización: crear, eliminar y restaurar ahora requieren exclusivamente `admin`. Listar y editar conservan la comprobación de asignación para representantes. Filtros privados: `q`, `commune`, `denomination`, `status`, `active`, `page`, `limit`.

Nuevo `GET /api/representatives?email=correo@dominio.cl`, solo admin, busca correo exacto de cuentas activas con rol representante/admin. Devuelve `{data:[{_id,name,email,role}]}` o lista vacía, sin perfil, contraseña ni preferencias. La ficha privada devuelve además `assignedAccounts` (nombre, correo, rol e ID) solo al administrador para identificar asignaciones actuales. No cambia roles. La asignación continúa validándose con el endpoint existente y exige al menos una cuenta autorizada.

Cada mutación de una ficha existente envía `If-Match: "<metadata.version>"`. Ante 409 se conservan las ediciones locales y se ofrece recargar explícitamente. Las respuestas 400 muestran detalles de validación. Una edición conserva la visibilidad; una ficha verificada queda publicada hasta nueva verificación. Publicar requiere los datos esenciales que valida el servidor. El representante asignado puede alternar publicación/borrador después de la primera publicación del administrador registrada en `metadata.firstPublishedByAdminAt`. No hay verificación automática institucional.

## Probar

1. Iniciar Backend y Frontend con sus scripts `npm.cmd run dev`. Usar cuentas cuyo rol ya esté autorizado; no se crea ni eleva ningún administrador desde este panel.
2. Como admin, abrir Administración, crear iglesia, completar nombre, comuna y punto público. Guardar y comprobar borrador.
3. Completar identidad, declaración doctrinal, reunión, responsable, fuente y autorización. Publicar. Editar y comprobar que permanece publicada; pasar a borrador explícitamente y comprobar que se oculta.
4. Buscar un representante por correo exacto, añadirlo y guardar asignaciones. Iniciar sesión con esa cuenta: debe ver y editar únicamente sus comunidades, sin botones de creación, baja ni publicación.
5. Como admin, dar de baja confirmando, filtrar Inactivas y restaurar. Comparar la versión antes/después.
6. Abrir la ficha en dos sesiones, guardar en una y luego en otra: la segunda debe recibir conflicto sin perder el texto.

Pruebas automáticas en bases temporales, sin escribir en desarrollo:

```powershell
cd Backend
npm.cmd test
cd ../Frontend
npm.cmd run build
npm.cmd run test:manage
npm.cmd test
npm.cmd run test:explore
```

`test:manage` verifica CRUD, publicación, asignaciones, matices del Forms, errores, conflicto, roles y móvil. Capturas en `Frontend/.cache/journey/08-admin-editor-desktop.png` y `09-representative-mobile.png`. Las teselas externas se bloquean en las pruebas; el mapa no depende de su disponibilidad para completar el formulario mediante coordenadas verificadas.

Los cambios del editor viven en memoria hasta guardar. Errores de API conservan el formulario; recargar/salir con cambios solicita confirmación. No hay guardado automático ni historial completo de revisiones.

## Creación y selección de representantes (2026-10-06)

`POST /api/representatives`, solo admin: `{name,email,position}`. Crea una cuenta pendiente y envía una invitación para que su propietario verifique el correo y elija contraseña. Durante la pausa de verificación admite `password` opcional: si se completa, permite acceso directo sin correo; vacía mantiene la invitación. No devuelve la contraseña. Respuesta 201 con datos básicos y estado `delivery`. La asignación de iglesias continúa siendo independiente. Ver [seguridad de cuentas](account-security.md).

`GET /api/representatives` ahora admite `email` opcional y `page/limit` (máximo 100), devuelve cuentas activas de rol representante con nombre, correo y cargo, y `pagination`. La lista desplegable carga páginas adicionales explícitamente; no requiere teclear correos para asignar. Las asignaciones previas de administradores se conservan. Crear una cuenta no la asigna en servidor: el panel la añade a la selección pendiente y el admin confirma con Guardar asignaciones.

El aislamiento por representante ya existente se mantiene para todas sus comunidades asignadas, sin restringir a una sola. El modelo de organizaciones no eclesiales queda pendiente.

## Visibilidad, tipos de reuniones y promoción (2026-10-07)

`privateFields` es un objeto opcional con booleanos `soteriology`, `eschatology`, `email`, `phone`. Marcado/true significa oculto. Ausente/false conserva la visibilidad anterior. El editor lo guarda junto a la ficha y permanece accesible a gestores autorizados. `publicChurch` elimina los valores marcados y el objeto de control en ficha, búsquedas, cercanía, guardados y recomendaciones; también elimina los arrays de correos/teléfonos importados correspondientes. No modifica el documento almacenado. Los textos libres y las fuentes independientes no se reescriben automáticamente: no duplicar datos reservados en descripciones públicas.

`meetingTypes: string[]` declara tipos de reuniones sin exigir horarios; admite opciones del catálogo y personalizadas. El perfil público presenta la unión sin duplicados de estos tipos y los tipos de reuniones detalladas. Los filtros por día siguen usando únicamente horarios explícitos. Para publicar, el requisito de reuniones se satisface con al menos un tipo declarado o una reunión detallada; no se inventa disponibilidad. Otros requisitos de publicación permanecen.

Clientes antiguos que omitan `privateFields` o `meetingTypes` en un PUT conservan sus valores existentes. Para retirar selecciones se envían booleanos false o un array vacío, respectivamente.

`GET /api/users/lookup?email=...`, exclusivo admin, normaliza el correo exacto y devuelve `{data:{_id,name,email,role,active}}` o `{data:null}`, sin contraseñas ni perfil. `POST /api/users/:id/promote-representative`, exclusivo admin y body `{}`, cambia atómicamente una cuenta activa de `user` a `representative`. Devuelve 409 si la cuenta cambió, está inactiva o ya tiene otro rol; no degrada administradores ni altera contraseñas. La asignación de comunidad sigue siendo explícita e independiente.

## Área Usuarios

Solo admin ve la barra Comunidades / Usuarios. `/administracion` abre Comunidades por defecto; `/administracion/usuarios` permite buscar por nombre/correo, filtrar rol y estado y paginar cuentas. Los representantes mantienen su panel de comunidades asignadas, sin acceso a Usuarios.

`GET /api/users/manage?q=&role=user|representative|admin&active=all|active|inactive&page=1&limit=12`: exclusivamente admin; búsqueda literal parcial por nombre o correo; respuesta administrativa limitada a `_id,name,email,position,role,active,createdAt,updatedAt`. No expone contraseñas ni preferencias, respuestas de incorporación, ubicación o contexto personal.

`PATCH /api/users/manage/:id`: exclusivamente admin. Body `{name,position,role,active,expectedUpdatedAt}`. Usa la fecha de actualización como condición de concurrencia; cambios obsoletos devuelven 409. No permite modificar correo, contraseña o perfil personal. El administrador no puede cambiar su propio rol ni desactivarse. La interfaz solicita confirmación concreta para cambios de rol/estado. Desactivar bloquea login y solicitudes con tokens existentes; reactivar conserva la cuenta y sus asociaciones. Las comunidades asignadas no se eliminan al cambiar rol/estado.

No incluye borrado físico ni recuperación de contraseñas. La creación de representantes permanece en el control administrativo de comunidades. Pruebas: `Backend/npm test` y `Frontend/npm run test:manage`; capturas de Usuarios en `.cache/journey/11-user-management-desktop.png` y `12-user-management-mobile.png`.
