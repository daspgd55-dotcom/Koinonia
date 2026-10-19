# Cuenta, perfil y multimedia

## Contraseñas

- POST `/api/auth/change-password`, Bearer: `{currentPassword,newPassword}`. Solo la cuenta autenticada; verifica la clave actual, exige una diferente y valida 8 caracteres mínimos/72 bytes UTF-8 máximos. Invalida todas las sesiones anteriores y cualquier enlace de recuperación. No devuelve contraseñas.
- POST `/api/auth/forgot-password`: `{email}`. Mensaje genérico para cuentas existentes e inexistentes. Una solicitud por cuenta/minuto, además del límite general de autenticación por IP (30/15 minutos). Enlace aleatorio de 256 bits, almacenado como hash SHA-256, vence a los 30 minutos.
- POST `/api/auth/reset-password`: `{token,newPassword}`. Consumo atómico de un solo uso, verifica expiración/cuenta activa e invalida sesiones. El enlace nuevo reemplaza al anterior. Abrir el enlace no lo consume; solo guardar una clave nueva lo hace.
- Campos internos `sessionVersion` y `passwordReset` no son editables mediante perfil ni se devuelven en sus respuestas. Las cuentas anteriores usan versión de sesión cero y se conservan.

Configuración de correo en el backend de Render (obligatoria para registros nuevos e invitaciones): `RESEND_API_KEY`, `MAIL_FROM` y `APP_PUBLIC_URL` (origen HTTPS del frontend, sin barra final). Configurar las tres juntas; si faltan todas, cambiar contraseña sigue funcionando y recuperar devuelve un error de servicio no configurado. Un fallo del proveedor queda como PASSWORD_MAIL_FAILED en logs, elimina el token emitido y conserva la respuesta genérica para evitar revelar cuentas.

Resend requiere verificar un dominio remitente para enviar a otros destinatarios. Su remitente de prueba resend.dev está restringido a pruebas con el propietario de la cuenta. El subdominio onrender.com no acredita propiedad de un dominio remitente. La integración queda probada con proveedor simulado; no se crearon cuentas externas ni se enviaron correos reales. Documentación: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

En la interfaz: enlace “¿Olvidaste tu contraseña?” en registro y acceso; “Mi perfil → Configuración de cuenta” permite cambiar la clave. Una clave aleatoria anterior no puede recuperarse en texto: se necesita establecer una nueva con el enlace. La recuperación real necesita configurar correo antes de ofrecerla a representantes.

## Perfil

Tres tarjetas de resumen coinciden con la encuesta: identidad, tradición y ubicación. La configuración conserva todas las preferencias anteriores agrupadas en esas tres secciones. No se borran respuestas ni se altera el estado de incorporación. La denominación depende de la rama en la interfaz; los valores históricos siguen almacenados.

## Fotos

Se pueden subir imágenes a comunidades activas, incluso borradores. Guardar previamente nombre, comuna y coordenadas permite crear la ficha. Subir o eliminar una foto conserva los demás cambios pendientes. Una foto local se puede descartar antes de subirla; un enlace aún no guardado se elimina localmente.

- DELETE `/api/churches/:id/media/:index`, Bearer admin/representante asignado y `If-Match` obligatorio: retira el recurso e incrementa versión conservando visibilidad. El índice empieza en cero. Solo intenta borrar en Cloudinary URLs del cloud configurado, generadas por nuestra aplicación para esa misma comunidad. Enlaces externos se retiran sin borrar archivos de terceros. Si Cloudinary falla, devuelve `warning` y registra MEDIA_CLEANUP_FAILED; requiere limpieza manual en Cloudinary. La retirada de la ficha sí queda guardada.
- Arrastrar miniaturas (ratón o pantalla táctil) reordena el arreglo media mediante el PUT existente al guardar. También admite flechas izquierda/derecha con foco en la miniatura. La primera imagen es portada.
- Antes de subir: zoom de 1 a 4, desplazamiento de la imagen y selección rectangular de proporción libre. Se exporta JPEG de hasta 1600 píxeles desde el original local, sin modificar el archivo del dispositivo. Se puede cancelar o reintentar si falla la subida.
- `media[].focalX` y `focalY`: números 0–100, opcionales, centro por defecto. Ajustan object-position en el marco, sin cambiar el archivo ya subido. Rechaza valores fuera de rango. La galería pública, descubrimiento y vista previa usan el mismo punto focal.
- Vista previa usa el formulario actual, incluyendo cambios sin guardar, reutiliza la ficha pública y oculta los cuatro atributos privados. Es local al administrador/representante; no publica borradores ni crea un endpoint público para ellos.
- “Quitar de la ficha” permite retirar un enlace dentro de una edición pendiente; al guardar no se elimina el archivo remoto. “Eliminar” ejecuta la retirada inmediata y la limpieza remota cuando corresponde.

## Publicación independiente de la edición

PUT de ficha y POST/DELETE de fotos conservan `published` o `draft`. Una ficha `verified` pasa a `published` al editar: permanece visible, pero necesita nueva verificación. PATCH `/api/churches/:id/status` acepta administrador o representante asignado; únicamente el administrador puede verificar o habilitar la primera publicación. Esa primera publicación registra `metadata.firstPublishedByAdminAt`, protegido contra escritura en el formulario. Desde entonces, el representante asignado puede alternar borrador/publicado, sujeto a las validaciones de completitud y versión existentes. Las cuentas sin asignación no pueden hacerlo.

Las fichas antiguas sin este registro conservan su visibilidad. Para habilitar el control del representante, un administrador debe pulsar Publicar una vez, incluso si ya estaban publicadas. No se infiere autorización a partir de datos importados.

Prueba manual: publicar como admin, entrar como representante asignado, editar texto/subir/eliminar foto y comprobar que sigue visible; pasar a borrador y comprobar que desaparece del buscador; volver a publicar. Probar arrastrar dos miniaturas y guardar; seleccionar una foto, ajustar zoom/recorte y descartarla; eliminar otra con cambios pendientes y comprobar que esos cambios siguen en pantalla.

## Pruebas

## Ficha pública y galería

La ficha completa, compartida por Explorar, Descubrir y la vista previa, agrupa identidad/doctrina, vida de comunidad, primera visita y contacto en apartados desplegables. Ubicación y reuniones quedan visibles. Incluye idiomas, afiliación, declaración de fe, públicos, duración y lugar de reuniones, liderazgo, acompañamiento y videos cuando hay datos. Los campos institucionales privados siguen excluidos.

`verification.source` es interno: se conserva en administración y base de datos, pero se omite de ficha, búsquedas, guardadas y recomendaciones públicas mediante `publicChurch`. La procedencia técnica ya excluida tampoco se publica. Esto no elimina las fuentes documentales aprobadas del sistema de recomendaciones.

La galería avanza cada cinco segundos con transición; admite pausa, flechas, miniaturas con desplazamiento horizontal y diálogo con zoom 1–4 y desplazamiento de la foto. Elegir manualmente pausa la presentación; puede reanudarse. También pausa al mantener el puntero encima o abrir el diálogo. Respeta movimiento reducido desactivando avance automático y animación. Esc cierra el diálogo y devuelve el foco al botón de apertura. Con una sola foto se desactiva la navegación.

`npm run test:explore` comprueba cambio automático, selección, zoom, cierre y presentación móvil; `npm run test:discover` comprueba acceso/regreso desde recomendaciones; `npm run test:manage` comprueba vista previa.

Backend: `npm test` incluye cambios de contraseña, revocación, expiración/consumo concurrente del enlace, no divulgación, subida y eliminación con autorización/versionado. Frontend: `npm test`, `npm run test:manage` y `npm run build`. Los proveedores externos se simulan para no consumir cuota ni enviar correos. Tras desplegar, validar entrega real de correo y eliminación en la cuenta Cloudinary configurada.

## Categorías multimedia y contraseña del representante

Cada elemento de `media` admite `category`: `facilities`, `meetings`, `activities`, `representatives` o `banner`. El campo es opcional para conservar compatibilidad; los recursos antiguos sin categoría se presentan como instalaciones. No se borran ni migran archivos. La edición usa el PUT de ficha existente y conserva su control de versión y permisos.

La subida admite `POST /api/churches/:id/media?category=meetings` (cuerpo binario y `If-Match` como antes). Sin parámetro usa `facilities`; una categoría inválida devuelve 400 antes de contactar al proveedor. Los límites de cantidad y tamaño existentes se mantienen. La categoría puede elegirse antes de subir o cambiarse después en cada recurso; los cambios de categoría y orden requieren guardar ficha.

Presentación: instalaciones en Visítanos; reuniones junto a sus horarios; actividades/recuerdos en Vida de comunidad; representantes junto a los datos de liderazgo; banner junto al nombre. Esto sustituye la regla provisoria del segundo recurso. Cada grupo tiene galería con zoom y navegación y enlaces a sus videos; no se crea el bloque si no hay recursos válidos. Descubrir prioriza la primera imagen de categoría banner y conserva la primera foto disponible como alternativa.

`POST /api/representatives` utiliza ahora invitaciones por correo y rechaza `password`. El destinatario define su contraseña al aceptar; no se devuelve `initialPassword`. Ver [contrato vigente de cuentas](account-security.md).

Validación: `npm test` en Backend cubre categorías válidas/inválidas, subida categorizada, hash, login con contraseña elegida y generación automática. En Frontend, `npm run test:manage` verifica selección antes/después de subir y creación desde el panel; `npm run test:explore` verifica ubicación de los cinco grupos, compatibilidad antigua y ausencia de bloques vacíos.

## Marcos, retratos y accesibilidad pública

`media[].frame`: landscape (3:2), wide (16:9), square (1:1), circle (1:1) o portrait (4:5). Banner admite wide/landscape; retratos de representantes circle/square. La ausencia del campo usa el marco por defecto de su categoría. El recorte previo utiliza el mismo marco con desplazamiento y zoom. El círculo es una máscara de presentación sobre un archivo cuadrado, por lo que se conserva una imagen completa para ampliarla.

Los registros de `leadership.mainLeader` y `leadership.otherLeaders[]` admiten `id` UUID estable. Al abrir una ficha antigua, la administración completa los identificadores ausentes mediante POST /api/churches/:id/leader-identifiers (If-Match con la versión entre comillas). Solo admin o representantes asignados pueden invocarlo; conserva nombres, cargos, fotos y publicación, e incrementa la versión solo si hubo cambios. Repetirlo conserva los identificadores. Una persona recién agregada al formulario sí debe guardarse antes de subir su retrato. `media[].leaderId` referencia ese identificador, no una cuenta de acceso ni el índice del arreglo. La subida usa también `?frame=circle&leaderId=<UUID>`. El backend exige que pertenezca a un líder con nombre de la misma ficha. Renombrar o reordenar conserva el vínculo. Quitar un líder en la interfaz elimina la asociación al guardar; el recurso se conserva sin mostrarse como retrato. Los recursos antiguos sin asociación deben asignarse manualmente. No se atribuyen fotos por orden o coincidencia de nombres.

`privateFields.accessibilityLevel=true` oculta `location.accessibilityLevel`, el booleano legado `location.accessibility` y `location.accessNotes` de toda respuesta pública y de la vista previa. Administración conserva estos datos. La ficha pública usa el rótulo Accesibilidad para personas con movilidad reducida; no muestra el bloque cuando no hay datos públicos.

La ficha pública agrupa a todas las personas bajo Representantes, sin títulos de jerarquía. Los registros sin foto ocupan solo su nombre y cargo. Los retratos conservan el zoom al pulsar, sin el aviso superpuesto.


## Estilos musicales y culturales
En Comunidad, musicalStyles es una selección múltiple opcional (máximo cinco, sin duplicados): Tradicional / Litúrgica, Himnodia Clásica, Góspel, Música Cristiana Contemporánea (MCC) / Worship, Géneros Urbanos y Alternativos. culturalStyle es una selección única opcional: Estilo Litúrgico, Estilo Conservador, Estilo Moderado o Estilo Contemporáneo. Los campos se guardan en community mediante los POST/PUT de iglesias existentes; una lista vacía y la ausencia de culturalStyle permiten quitar las selecciones. No se asignan estilos a fichas antiguas.

privateFields.musicalStyles y privateFields.culturalStyle son booleanos independientes: true conserva el dato en administración y lo excluye de las respuestas públicas y de la vista previa. False o ausencia permite mostrarlo. Vida de comunidad muestra etiquetas musicales y el estilo cultural con su descripción; no crea apartados sin datos. No modifica el ranking ni añade filtros de búsqueda en esta entrega.

Pruebas: Backend node --test test/api.test.js; Frontend npm run test:manage, npm run test:explore y npm run build. Cubren selección múltiple, persistencia, valores inválidos/duplicados, aislamiento, privacidad independiente, vista previa y presentación móvil.
