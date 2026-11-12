# Correos de invitaciones de Koinonía

## Archivos que puedes editar

- `content.js` contiene asuntos, texto corto de bandeja (`preheader`), títulos, párrafos, pasos y textos de botones de todas las fases. El bloque `roles` contiene los nombres y alcances de cada función.
- `layout.js` contiene el diseño HTML común, los colores, las fuentes y el espaciado. También genera el texto simple del correo con el mismo contenido. Escapa todos los datos variables antes de insertarlos en HTML.
- `../../services/church-outreach-mail-templates.js` selecciona la fase y publica la versión de las plantillas. Incrementa `version` cuando cambies contenido destinado a nuevos envíos.

Para cambiar un párrafo, edita el texto entre comillas en `content.js`. Conserva los nombres de los campos y las expresiones `${name}`. Estas expresiones insertan la iglesia de cada destinatario. `cta` cambia la etiqueta del botón. El enlace se obtiene desde el servidor.

Los mensajes ya preparados contienen una copia del contenido. Después de editar las plantillas, prepara una nueva vista previa o lote para revisar la nueva versión. Los cambios del backend deben desplegarse para llegar a Render.

## Fases

| Clave | Uso | Integración actual |
| --- | --- | --- |
| `initial` | Invitación al contacto institucional | Lote institucional confirmado por admin |
| `renewal` | Nuevo enlace solicitado por el contacto institucional | Cola de renovaciones de Make |
| `clarification` | Solicitud de aclaración con el mensaje del admin | Nuevo envío institucional al pedir aclaraciones |
| `institutional-reminder` | Recordatorio al contacto | Lote de recordatorio seleccionado por admin |
| `member` | Invitación individual con rol aprobado | Envío de representantes aprobados |
| `member-reminder` | Recordatorio de aceptación | Lote de recordatorio seleccionado por admin |
| `activated` | Confirmación de función activa | Aceptación individual completada |
| `received` | Recepción de propuesta | Redactada y disponible para integrar un envío futuro |
| `approved` | Resultado de revisión dirigido al contacto | Redactada y disponible para integrar un envío futuro |
| `rejected` | Rechazo de propuesta dirigido al contacto | Redactada y disponible para integrar un envío futuro |

Los textos de recepción y resolución son plantillas preparadas. La solicitud actual incorpora diseño y contenido a los envíos ya existentes. La aceptación, el rechazo y el no contacto también tienen confirmación en pantalla. El no contacto no genera un correo adicional.

## Vista previa local

Desde la raíz del repositorio ejecuta `node Backend/scripts/preview-outreach-emails.js` y abre `outputs/correos-invitaciones/index.html`. Se generan muestras HTML y TXT con una iglesia ficticia. El script solo escribe archivos locales. También puedes expandir la vista previa del lote en el panel Admin para ver su HTML y texto antes de enviarlo.

Los archivos HTML usan tablas de presentación, estilos en línea, fuentes del sistema y ancho adaptable. Los enlaces personales y textos variables se escapan. El transporte conserva HTML y texto simple tanto en el envío directo como en la cola cifrada. Resend admite ambas representaciones en un mensaje. [Documentación del proveedor](https://resend.com/changelog/automatic-plain-text-emails)

## Manuales

Los correos no adjuntan manuales. Tras aceptar una invitación, el panel de administración muestra la descarga del manual que corresponde al rol efectivo de la cuenta. La confirmación de acceso informa esta opción.

La galería permite revisar el aspecto en navegador. La apariencia en Gmail, Outlook y otros clientes y la entrega real requieren una comprobación posterior con buzones controlados.
