# Cuenta, perfil y multimedia

## Contraseñas

- POST `/api/auth/change-password`, Bearer: `{currentPassword,newPassword}`. Solo la cuenta autenticada; verifica la clave actual, exige una diferente y valida 12 caracteres mínimos/72 bytes UTF-8 máximos. Invalida todas las sesiones anteriores y cualquier enlace de recuperación. No devuelve contraseñas.
- POST `/api/auth/forgot-password`: `{email}`. Mensaje genérico para cuentas existentes e inexistentes. Una solicitud por cuenta/minuto, además del límite general de autenticación por IP (30/15 minutos). Enlace aleatorio de 256 bits, almacenado como hash SHA-256, vence a los 30 minutos.
- POST `/api/auth/reset-password`: `{token,newPassword}`. Consumo atómico de un solo uso, verifica expiración/cuenta activa e invalida sesiones. El enlace nuevo reemplaza al anterior. Abrir el enlace no lo consume; solo guardar una clave nueva lo hace.
- Campos internos `sessionVersion` y `passwordReset` no son editables mediante perfil ni se devuelven en sus respuestas. Las cuentas anteriores usan versión de sesión cero y se conservan.

Configuración de correo opcional en el backend de Render: `RESEND_API_KEY`, `MAIL_FROM` y `APP_PUBLIC_URL` (origen HTTPS del frontend, sin barra final). Configurar las tres juntas; si faltan todas, cambiar contraseña sigue funcionando y recuperar devuelve un error de servicio no configurado. Un fallo del proveedor queda como PASSWORD_MAIL_FAILED en logs, elimina el token emitido y conserva la respuesta genérica para evitar revelar cuentas.

Resend requiere verificar un dominio remitente para enviar a otros destinatarios. Su remitente de prueba resend.dev está restringido a pruebas con el propietario de la cuenta. El subdominio onrender.com no acredita propiedad de un dominio remitente. La integración queda probada con proveedor simulado; no se crearon cuentas externas ni se enviaron correos reales. Documentación: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

En la interfaz: enlace “¿Olvidaste tu contraseña?” en registro y acceso; “Mi perfil → Configuración de cuenta” permite cambiar la clave. Una clave aleatoria anterior no puede recuperarse en texto: se necesita establecer una nueva con el enlace. La recuperación real necesita configurar correo antes de ofrecerla a representantes.

## Perfil

Tres tarjetas de resumen coinciden con la encuesta: identidad, tradición y ubicación. La configuración conserva todas las preferencias anteriores agrupadas en esas tres secciones. No se borran respuestas ni se altera el estado de incorporación. La denominación depende de la rama en la interfaz; los valores históricos siguen almacenados.

## Fotos

Se pueden subir imágenes a comunidades activas guardadas como borrador. No requieren publicación. Guardar previamente nombre, comuna y coordenadas permite crear la ficha. Los cambios pendientes deben guardarse antes de subir o eliminar.

- DELETE `/api/churches/:id/media/:index`, Bearer admin/representante asignado y `If-Match` obligatorio: retira el recurso, incrementa versión y vuelve a borrador. El índice empieza en cero. Solo intenta borrar en Cloudinary URLs del cloud configurado, generadas por nuestra aplicación para esa misma comunidad. Enlaces externos se retiran sin borrar archivos de terceros. Si Cloudinary falla, devuelve `warning` y registra MEDIA_CLEANUP_FAILED; requiere limpieza manual en Cloudinary. La retirada de la ficha sí queda guardada.
- “Subir/Bajar recurso” reordena el arreglo media mediante el PUT existente al guardar. La primera imagen es portada.
- `media[].focalX` y `focalY`: números 0–100, opcionales, centro por defecto. Ajustan object-position en el marco, sin cambiar el archivo. Rechaza valores fuera de rango. La galería pública, descubrimiento y vista previa usan el mismo punto focal. El recorte libre/zoom queda pendiente.
- Vista previa usa el formulario actual, incluyendo cambios sin guardar, reutiliza la ficha pública y oculta los cuatro atributos privados. Es local al administrador/representante; no publica borradores ni crea un endpoint público para ellos.
- “Quitar de la ficha” permite retirar un enlace dentro de una edición pendiente; al guardar no se elimina el archivo remoto. “Eliminar” ejecuta la retirada inmediata y la limpieza remota cuando corresponde.

## Pruebas

Backend: `npm test` incluye cambios de contraseña, revocación, expiración/consumo concurrente del enlace, no divulgación, subida y eliminación con autorización/versionado. Frontend: `npm test`, `npm run test:manage` y `npm run build`. Los proveedores externos se simulan para no consumir cuota ni enviar correos. Tras desplegar, validar entrega real de correo y eliminación en la cuenta Cloudinary configurada.
