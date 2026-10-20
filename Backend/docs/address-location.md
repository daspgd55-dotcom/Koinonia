# Dirección como punto de partida

La dirección del perfil puede usarse para distancias y recomendaciones sin permiso GPS. En Preferencias de búsqueda → Tu ubicación, «Activar ubicación» habilita el dispositivo. Dentro aparece «Preferir mi dirección en lugar de mi ubicación actual»: marcada utiliza la dirección; desmarcada utiliza el dispositivo. Al desactivar la casilla principal no se calculan distancias. Las cuentas anteriores conservan el comportamiento de dispositivo; no se convierten automáticamente sus direcciones.

## Activación

Crear una clave en Geoapify y configurar `GEOAPIFY_API_KEY` exclusivamente en el entorno del backend (en Render: Environment). Reiniciar el servicio después de configurar la variable. No usar prefijos VITE ni publicar la clave. Documentación: https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/

Sin clave, la API responde 503 al comprobar una dirección. Se puede continuar usando dispositivo o comuna si no se introduce una dirección nueva o modificada. La aplicación no depende del servicio para iniciar ni para consultar una dirección ya confirmada. Las pruebas automatizadas sustituyen al proveedor y no verifican cobertura real de calles.

## Contrato

- `POST /api/users/me/address/resolve`, autenticado, cuerpo `{address, commune}`: devuelve `{data, status, attribution}`. Cada candidato incluye `label, lat, lng, address, commune, verifiedAt, token`. No guarda el perfil. Límite 20 consultas/hora/usuario; respuesta no almacenable. `status` es `found` o `not_confirmed`.
- `PATCH /api/users/me`: `searchContext.locationSource` admite `device|address|none`. Para confirmar un candidato, enviar `addressToken` junto a dirección/comuna coincidentes y `expectedRevision`. El token firmado vence a los 15 minutos y está vinculado al usuario. Un token vencido/modificado devuelve 400 `ADDRESS_CONFIRMATION_EXPIRED`; perfil desactualizado, 409 `STALE_PROFILE`.
- `searchContext.addressPoint` es privado y de escritura exclusiva del servidor. Se devuelve únicamente en el perfil autorizado. No se admite como entrada del cliente. Cambiar calle o comuna invalida la confirmación. La posición del dispositivo permanece en `preferences.location`.
- `/recommendations` utiliza la fuente elegida, sin recurrir silenciosamente al dispositivo cuando no se confirmó una dirección. La ubicación explícita de una consulta conserva su contrato previo. Un radio obligatorio requiere una referencia válida; un radio deseable puede guardarse sin ella, pero no genera distancias.

## Precisión y privacidad

Al guardar una dirección nueva o modificada (o elegir una dirección todavía sin confirmar), se envía calle, número y comuna a Geoapify. No se consulta mientras se escribe. No se envía identidad, correo ni contraseña. No introducir departamento u otros datos personales. Se solicitan resultados chilenos y se exige número coincidente, comuna coincidente, confianza ≥0,8 y resultado edificio/amenity. Se limita al rectángulo del piloto de Santiago (-33,85 a -33,1; -71 a -70,3); no es validación de límites administrativos. Una dirección no encontrada no equivale a una dirección inexistente. La web acepta automáticamente un único candidato preciso. Si no hay resultados, hay varios o falla el proveedor, no guarda el perfil y conserva las respuestas mostrando el error. Una dirección ya confirmada y sin cambios no requiere nueva consulta. Una dirección histórica sin modificar no bloquea ediciones ajenas a la ubicación. Las coordenadas se redondean a tres decimales; las distancias son aproximadas en línea recta, no recorridos por calles.

## Pruebas

`cd Backend` y `node --test test/address-location.test.js`: MongoDB temporal, proveedor simulado, autenticación, token entre usuarios, datos inválidos, ausencia de proveedor, selección de fuente, invalidación y concurrencia de perfil.

`cd Frontend` y `node test/address-location.cjs`: recorrido con dirección confirmada sin GPS, guardado y recuperación, cambio de fuente y ausencia de resultados. `npm run build` verifica compilación.

Comprobación manual tras configurar la clave: ingresar calle y número reales del piloto, activar ubicación, marcar preferir dirección y guardar. Revisar distancias en Para ti. Cambiar la calle y verificar que exige nueva confirmación. Si el proveedor no tiene suficiente precisión, usar dispositivo; no se toma el centro de la comuna como domicilio.

La web comprueba también una dirección modificada si la fuente elegida es dispositivo o ninguna. Si no puede confirmarla, se puede corregir o retirar la dirección opcional para guardar. Pruebas de preparación del guardado: `cd Frontend` y `node --test test/prepare-address.test.js`.
