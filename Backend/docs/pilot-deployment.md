# Piloto: Render, MongoDB Atlas y Cloudinary

Estado: integración implementada y plantilla de despliegue preparada. No se han creado cuentas externas, migrado datos ni publicado servicios. El despliegue y la subida real requieren credenciales del propietario.

## Configuración manual del propietario

1. Crear una cuenta gratuita de Cloudinary. En Settings > API Keys obtener Cloud name, API Key y API Secret. Configurar `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` en `Backend/.env` para probar localmente y en los secretos del servicio API de Render para el piloto. No ponerlos en React, Git ni en el chat. No hace falta un preset de subida unsigned.
2. Crear un clúster gratuito de MongoDB Atlas y un usuario de base de datos con lectura/escritura sobre la base `koinonia_pilot`. Autorizar las direcciones salientes del servicio Render en Network Access (y la IP de desarrollo si se prueba desde el PC). Configurar `MONGO_URI` con la cadena SRV de Atlas, base explícita y contraseña codificada para URL. La contraseña del usuario de base de datos es distinta de la cuenta Atlas.
3. Publicar el código en un repositorio privado y conectar Render. Revisar exclusiones antes de subir: `.env`, cachés y node_modules quedan ignorados; revisar también documentos, datasets y archivos previamente rastreados. Crear los servicios desde `render.yaml` o mediante el panel con los mismos comandos.
4. En la API configurar `CORS_ORIGINS=https://<frontend>.onrender.com` (sin barra final), `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`, `JWT_SECRET` aleatorio y los secretos anteriores. En React configurar `VITE_API_BASE_URL=https://<api>.onrender.com/api` antes de compilar. Usar las URLs efectivamente asignadas; los nombres de la plantilla no garantizan disponibilidad. Si cambia la URL de API, recompilar React.
5. Verificar `/health`, abrir React y registrar una cuenta. Para el primer administrador usar el script existente `npm run user:role` según Backend/README.md, apuntando explícitamente a la base piloto. No copiar cuentas de prueba automáticamente ni ejecutar seed contra datos reales.

Se recomienda iniciar la base piloto vacía y cargar solo comunidades autorizadas. Una migración de los datos locales necesita respaldo y revisión de qué datos trasladar; esta implementación no migra ni borra datos. Las cuentas existentes continúan en la base indicada por MONGO_URI.

Si Atlas ya contiene una base, usar su nombre con las mismas mayúsculas en MONGO_URI. Por ejemplo, para una base existente `Koinonia_pilot`, la ruta debe ser `/Koinonia_pilot`, no `/koinonia_pilot`. El error `db already exists with different case` se resuelve corrigiendo la conexión y desplegando de nuevo; no requiere borrar la base ni cambiar las IP autorizadas.

Mantener `npm ci --omit=dev` como comando de instalación del backend. Las correcciones de dependencias deben guardarse en `Backend/package-lock.json`, subirse al repositorio y desplegarse. `npm ci` no ejecuta `npm audit fix` automáticamente: el aviso de npm solo sugiere ese comando. La actualización de proxy-addr a 2.0.8 corrige GHSA-jqcg-44mw-7w3h; comprobar producción con `npm audit --omit=dev`.

Render gratuito puede tardar en despertar. El cliente espera hasta 90 segundos para solicitudes normales. Las fotos se alojan en Cloudinary; en MongoDB solo queda su URL y atribución. No se escriben imágenes al disco del servidor.

## Contrato de subida

`POST /api/churches/:id/media`

- Bearer requerido: admin o representante asignado a una comunidad activa.
- `If-Match: "<version>"` obligatorio; usar la versión de GET `/api/churches/manage/:id`.
- Cuerpo binario de imagen; Content-Type `image/jpeg`, `image/png` o `image/webp`. No multipart ni JSON. Máximo 5 MiB. Se valida cabecera binaria; Cloudinary decodifica la imagen y rechaza contenido inválido.
- Máximo cinco imágenes al subir y treinta recursos totales. Los enlaces existentes se conservan, incluso si un registro antiguo ya supera cinco fotos. Hasta veinte intentos por cuenta/hora/instancia; el límite en memoria reinicia con el servicio.
- La API envía la imagen a Cloudinary con autenticación privada, limita a 1600x1600 y convierte a WebP. La respuesta válida se adjunta atómicamente a la comunidad con control de versión y permisos. Devuelve `201 {data: <ficha privada actualizada>}`; incrementa versión y conserva visibilidad (verified pasa a published).
- Errores: 400 formato/límite, 401 sesión, 403 permisos, 404 comunidad, 409 conflicto, 413 tamaño, 428 versión ausente, 429 frecuencia, 502 proveedor, 503 credenciales no configuradas.
- Si la persistencia falla después de subir, se intenta eliminar el archivo recién creado. Un fallo de limpieza se registra como MEDIA_CLEANUP_FAILED para revisión en Cloudinary. Una interrupción abrupta o respuesta perdida puede dejar un recurso huérfano; revisar el directorio koinonia periódicamente durante el piloto.

La comunidad debe estar guardada, pero puede estar en borrador. Subir y eliminar conservan los cambios pendientes del formulario. Se puede recortar, ajustar zoom o descartar la foto local antes de subir. La subida ya guarda la imagen; no requiere pulsar Guardar ficha después. Tras un error de red ambiguo, recargar la ficha antes de repetir para comprobar si quedó guardada. Quitar un enlace del formulario retira la foto de la ficha al guardar, pero no borra el recurso de Cloudinary; el botón Eliminar permite intentar la limpieza remota de las fotos propias. El orden se cambia arrastrando miniaturas y se conserva al guardar. Consulta account-media.md para el contrato actualizado.

## Verificación

`cd Backend` y `npm test`: incluye proveedor simulado, permisos, firmas de archivos, tamaño, errores, persistencia, concurrencia y limpieza. No consume cuota Cloudinary.

`cd Frontend` y `npm run build`, `npm run test:manage`: compilación y recorrido de administración con base temporal.

Prueba real tras configurar cuentas: entrar como representante, abrir una comunidad asignada, guardar cambios, ir a Validación y multimedia, subir una foto, recargar y comprobar persistencia. Publicar como admin y comprobar foto en Descubrir. Con otro representante comprobar que no puede administrar ni subir a esa comunidad. Repetir en móvil. Esta prueba con proveedor y alojamiento reales sigue pendiente hasta configurar las cuentas.

Referencias: https://cloudinary.com/documentation/upload_images · https://render.com/docs/blueprint-spec · https://www.mongodb.com/docs/atlas/getting-started/
