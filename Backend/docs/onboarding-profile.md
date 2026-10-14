# Encuesta y perfil de usuario

Contrato actual: incorporación v3 de tres fases y configuración detallada independiente. Las rutas son relativas a `/api`. La API conserva compatibilidad con v1 y v2; los apartados v2 siguientes documentan el formato anterior.

## Rutas

- `POST /auth/register`: crea la cuenta; `POST /auth/login` entrega el token Bearer.
- `GET /users/me`: perfil propio con preferences, searchContext, criterionModes, answerStates, onboarding y profileRevision.
- `PATCH /users/me`: guarda únicamente los campos enviados. Reanuda o edita sin eliminar campos ajenos al cambio.
- `PUT /users/me/preferences`: reemplazo completo legado; el cliente nuevo usa PATCH.
- `POST /recommendations`: aplica preferencias y modos almacenados, con reemplazos temporales por solicitud.

No se aceptan roles, ID de otro usuario ni fechas de servidor en el perfil. La respuesta de cambio de rol devuelve solo id/role, nunca el contexto de otra persona.

## Encuesta inicial v2

| Paso | Pregunta | Campos |
|---|---|---|
| 1 | Qué buscas | searchContext.goal: join, explore, change, connect |
| 2 | Rama | preferences.branches |
| 3 | Denominación según rama | preferences.denominations |
| 4 | Ubicación | preferences.commune, searchContext.address, preferences.location, preferences.radiusKm |

Las opciones sin respuesta concreta (incluida Ninguna de las anteriores) se representan con `answerStates: {campo: "no_preference"}` y valor nulo. No se almacenan como etiquetas religiosas. La UI no usa menús desplegables de estado ni de interpretación de criterios. Termina en el cuarto paso, sin pantalla adicional de revisión.

`searchContext.address` es texto privado opcional, máximo 200 caracteres. Se puede borrar con null o estado no_preference. No participa en filtros o ranking, no se geocodifica y no se envía al adaptador semántico. `preferences.location` sigue siendo `{lat,lng}` internamente, obtenido con permiso del navegador; la web no muestra campos ni números de coordenadas. Retirar la casilla borra el punto al guardar.

El deslizador inicial ofrece 1–50 km y no establece un radio hasta interactuar con él. Una preferencia antigua superior a 50 se mantiene y amplía el rango mostrado durante esa edición. El backend conserva el rango válido hasta 200 km por compatibilidad. Distancia deseable sin punto se conserva, pero no se calcula; distancia obligatoria sin coordenadas válidas se rechaza.

## Configuración del perfil

Ruta web `/configuracion` (navegación por hash), separada de la encuesta. Categorías: contexto, identidad, ubicación, doctrina/prácticas, actividades/ministerios/público, días/idiomas y primera visita. Las opciones proceden de la ficha institucional según `docs/diseno/catalogo-ficha-y-filtros.md` y `Frontend/src/catalog.js`.

La casilla de cada grupo mapea a `required` si se marca y `preferred` si se desmarca. La incorporación escribe preferencias por defecto al modificar una respuesta. No se infieren restricciones de la pertenencia religiosa. Los valores legados desactivados se preparan como preferencias al abrir la configuración desde el perfil y se persisten solo al guardar; no se borran.

Modos de la API: `preferred` favorece coincidencias, `required` exige evidencia de coincidencia, `disabled` conserva el valor sin aplicarlo (compatibilidad; ya no hay selector de este modo en la UI). Una respuesta vacía desactiva su criterio. Denominaciones, ramas, idiomas y días aceptan cualquiera de los valores del grupo; etiquetas, actividades, ministerios y públicos obligatorios exigen todos los seleccionados. Los modos son por grupo, no por elemento.

## Guardado, estados y versión

PATCH omite lo que no debe cambiar. null o [] limpia una respuesta. `answerStates` mantiene answered/no_preference/unknown/omitted; unknown y omitted legados se conservan hasta editar. Enviar valor concreto y estado no_preference a la vez se rechaza. Contexto admite goal, firstVisitPreference y address; no se utiliza para puntuar.

`onboarding`: status pending/completed/skipped, version 1 o 2, lastStep. En v2 lastStep permite 0–4: 0–3 son el índice del siguiente paso visible, 4 representa finalización. En v1 se conserva el rango 0–7. El servidor controla updatedAt y completedAt. Completar permite omisiones; skipped conserva respuestas. Guardar configuración no envía onboarding y conserva su estado, versión y paso.

Las cuentas antiguas no se migran masivamente ni se eliminan respuestas. La posición visual de un borrador de siete pasos se reinicia a 0 si no puede interpretarse en el nuevo flujo; sus respuestas pendientes se conservan. Las cuentas ya completadas siguen completadas. Los valores personalizados o fuera del catálogo continúan visibles y editables.

`profileRevision` aumenta con cada escritura. Enviar expectedRevision permite detectar una pantalla antigua con `409 STALE_PROFILE`. La UI carga el perfil reciente, conserva las ediciones pendientes y requiere que el usuario vuelva a guardar después de revisarlas. Omisiones, límites de texto, estados/versiones inválidos y ausencia de ubicación para radio obligatorio dan `400 VALIDATION_ERROR`.

## Ejemplo

`PATCH /api/users/me`, con Authorization Bearer:

```json
{
  "expectedRevision": 0,
  "searchContext": {"goal":"join","address":"Referencia opcional"},
  "preferences": {"commune":"Providencia","branches":["Protestante"],"denominations":["Metodista"],"radiusKm":17},
  "criterionModes": {"branches":"preferred","denominations":"preferred","commune":"preferred","radiusKm":"preferred"},
  "onboarding": {"version":2,"status":"completed","lastStep":4}
}
```

Configuración: `{"preferences":{"ministries":["Jóvenes","Música / alabanza"]},"criterionModes":{"ministries":"required"}}`. Desmarcar restricción: `{"criterionModes":{"ministries":"preferred"}}`. Ausencia: `{"preferences":{"branches":null},"answerStates":{"branches":"no_preference"}}`.

## Recomendador y privacidad

Se mantiene el ranking estructurado: solo criterios obligatorios filtran; los deseables puntúan. Datos desconocidos se señalan, sin inventar atributos ni relajar condiciones silenciosamente. Modos ausentes conservan comportamiento legado. El ranking personalizado evalúa todos los candidatos elegibles mediante cursor; el legado sin modos mantiene límite 100 y aviso de truncamiento. Puntajes y pesos siguen siendo provisionales.

El adaptador recibe las preferencias activas y candidatos; nunca searchContext, address, answerStates, onboarding ni ID del usuario. Los filtros públicos GET `/churches/search` y `/nearby` mantienen su contrato anterior. Las opciones de filtros futuros documentadas no se presentan como funciones ya implementadas.

## Pruebas

Desde Backend: `npm.cmd test`. Desde Frontend: `npm.cmd run build` y `npm.cmd test`. Utilizan bases temporales independientes. El recorrido prueba los cuatro pasos, listas dependientes, ausencia de respuesta, reanudación, GPS denegado/activado/retirado, slider, configuración, casillas de restricción, errores, conflictos, expiración, cuentas antiguas y móvil.

## Incorporación v3 (vigente)

Fase 1: `searchContext.spiritualIdentity` (`christian`, `believer`, `no_religion`, `other_religion`, `nonbeliever`, `other`) y `goal`. La omisión se guarda como null con su answerState. La identidad espiritual es privada y no se envía como criterio de ranking.
Fase 2: rama y, solo para Protestante/Rama Independiente, denominación. Las respuestas anteriores se conservan al ocultarse el control y siguen editables en configuración.
Fase 3: comuna, dirección opcional, ubicación voluntaria y radio.

`onboarding.version=3`, `lastStep=0..3`: 0–2 representan fases y 3 finalización. No vuelve a abrirse automáticamente tras login aunque el estado sea pendiente u omitido. El usuario puede retomarla voluntariamente. Borradores anteriores conservan respuestas pendientes; su posición incompatible se reinicia a cero.

Un radio legado sin modo explícito no se convierte en restricción en el cliente. La comprobación de radio obligatorio exige ubicación cuando se edita radio, ubicación o sus modos/estados, sin bloquear cambios de contexto independientes por inconsistencias históricas.


## Identidad editable y organización de Mi perfil

La página `#/perfil` presenta, en orden: Editar perfil (nombre público, nombre de usuario, correo de solo lectura y Mi iglesia); Identidad, tradición y ubicación; Cuenta (cambio de contraseña); Avanzado. En Avanzado se pueden descartar, con confirmación, los cambios locales de preferencias todavía sin guardar, recuperando los valores del servidor. No elimina datos guardados ni la cuenta.

`PATCH /api/users/me` acepta además `name` (texto recortado, 1–100 caracteres) y `username` (3–24 caracteres ASCII, empieza con letra, permite letras, números y guion bajo). El username se normaliza a minúsculas y es único mediante índice de base de datos, incluso ante peticiones simultáneas. Se reservan admin, administrator, administrador, root, soporte, support, koinonia y moderador. Las cuentas existentes pueden carecer de username; no se asigna uno automáticamente. Al omitir un campo se conserva su valor. El nombre público se propone como autor para nuevas experiencias; no modifica experiencias anteriores.

Ejemplo de cuerpo: `{"name":"María Comunidad","username":"maria_comunidad","expectedRevision":3}`. Respuesta: perfil propio actualizado con nueva `profileRevision`. Username ocupado devuelve 409 `USERNAME_TAKEN`; revisión obsoleta, 409 `STALE_PROFILE`; formato inválido o intento de cambiar email/role, 400. El correo solo es visible para el titular en este formulario, no se añade a la presentación pública. Se utiliza exclusivamente el usuario autenticado, sin aceptar ID de destino.

Verificación: en Backend ejecutar `node --test test/api.test.js`; en Frontend, `npm test` y `npm run build`. Las pruebas usan una base efímera: cubren cuentas sin username, normalización, unicidad concurrente, correo inmutable, aislamiento, conservación de preferencias y formulario móvil con error de duplicado y guardado correcto.
