# Asociaciones de contactos — preparación de importación

En Administración → Invitaciones a iglesias → Importar contactos se pueden pegar celdas desde Excel (con encabezados) o cargar CSV/TSV UTF-8. La lectura directa de XLSX queda para la adaptación al archivo real. Se mapean columnas de nombre, correo, teléfono, web, Facebook, Instagram, YouTube, comuna y dirección. Máximo 500 filas por lote y cuerpo JSON de 128 KB (la UI reserva margen).

POST `/api/church-contact-imports/preview` recibe `{source,rows:[{row,name,email,phone,website,facebook,instagram,youtube,commune,address}]}`. Solo nombre/fila son necesarios en cada registro; campos de contacto omitidos se convierten en cadenas vacías. Todas las rutas requieren administrador global. La vista previa no escribe. Conserva nombres con acentos y compara tras normalizar Unicode, espacios y mayúsculas; no hace correspondencia difusa. Dos fichas del mismo nombre requieren resolver la ambigüedad: la opción Resolver esta fila permite elegir explícitamente un candidato para actualizarlo y guardar la asociación. Los contactos ayudan a revisar, nunca autorizan representación.

POST `/api/church-contact-imports/confirm` recibe lo anterior más `digest` y `selectedRows`. Recalcula la comparación y rechaza cambios desde la vista previa. Guarda solo coincidencias únicas expresamente seleccionadas. Archivo/hoja y fila quedan registrados junto a contactos y comparación. Un índice de huella evita duplicar una confirmación idéntica, incluso concurrente. Un archivo diferente constituye otro lote de procedencia; no crea una nueva iglesia ni invitación. Las asociaciones son instantáneas revisadas: la futura preparación de invitaciones deberá volver a comprobar la ficha y supresiones. La confirmación no bloquea ediciones concurrentes de Church.

GET `/api/church-contact-imports` muestra los últimos 20 lotes. La colección `ChurchContactImport` contiene información administrativa privada. No cambia `Church`, `User`, permisos, suscripciones ni correos públicos; no emite tokens ni invoca proveedores. Datos de prueba y fichas inactivas se identifican, sin habilitarlas para envío. Fichas fusionadas quedan excluidas. Filas sin correo y con correo inválido pueden conservarse para revisión; no son destinatarios habilitados.

Pendiente: adaptación XLSX al archivo entregado, preparación de invitaciones desde asociaciones, conexión Make y reconciliación de envíos. Reutilizar las guardas de invitaciones al implementar esa etapa, sin convertir correspondencia de identidad en consentimiento ni permisos.

Verificación: `node --test test/church-contact-import.test.js` desde Backend; `node --test test/contact-import.test.js` y `npm run build` desde Frontend. Las pruebas usan MongoDB efímero local y bloquean fetch externo.

## Resolución explícita (8 de noviembre de 2026)

La casilla Seleccionar todas marca exclusivamente filas matched, muestra estado parcial y permite desmarcarlas. Cada fila ofrece Resolver esta fila: actualizar un candidato no fusionado o crear una iglesia distinta. Se eligen campos a aplicar; los vacíos nunca borran información. En una ficha publicada los cambios seleccionados pueden ser visibles públicamente. La creación requiere nombre, comuna y coordenadas reales; guarda active=false y metadata.dataStatus=draft.

POST `/api/church-contact-imports/resolve` requiere administrador global y recibe source, row, mode (update/create), fields y, según modo, churchId/fingerprint o digest/latitude/longitude. La actualización solo acepta candidatos con el nombre normalizado de la fila. Para nombres sin coincidencia esta interfaz ofrece crear una iglesia, no seleccionar una ficha arbitraria. La creación comprueba una vista previa individual reciente. La interfaz solicita esa vista previa después de editar los datos de creación. Se rechazan correos inválidos.

La ficha y ChurchContactImport se guardan en una transacción. La huella de petición hace idempotente una repetición idéntica. El registro guarda campos seleccionados y valores previos de contacto y ubicación; no cambia equipo, permisos ni autorización institucional. El correo queda asociado a la nueva ficha para la futura preparación de invitación; no se crea ChurchOutreachInvitation ni se emite enlace en esta etapa. Una petición diferente para crear otra iglesia sigue siendo una decisión explícita distinta: la huella no es deduplicación por identidad mundial.

Tras resolver se debe analizar otra vez el lote, porque cambió la base usada para comparar. Las asociaciones anteriores permanecen en el historial.
