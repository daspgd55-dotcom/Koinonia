# Indicadores de carga

`src/Loading.jsx` utiliza el símbolo aprobado en WebP animado, con GIF transparente como alternativa. Los archivos se sirven desde `public/loading/`; el PNG estático se muestra cuando está activa la preferencia de movimiento reducido. `public/loading.css` también se utiliza en `index.html` para mostrar el indicador antes del arranque de React.

Usar `<Loading label="Cargando eventos…"/>` para una sección, `page` para una pantalla e `inline` dentro de botones o textos breves. La etiqueta describe la operación y permanece disponible para lectores de pantalla; las imágenes son decorativas. No hay demoras artificiales en los indicadores locales.

`api.js` registra las solicitudes con `requestActivity.js`. `RequestActivity` muestra un aviso no bloqueante después de 350 ms cuando no hay otro indicador local visible. Cada solicitud se retira del registro en `finally`, también en errores o desconexiones. Las comprobaciones CAPTCHA liberan el indicador mientras requieren intervención y registran nuevamente el reintento.

Las consultas periódicas del chat, los resúmenes de mensajes y los conteos de notificaciones utilizan `background:true`. Las listas y conversaciones conservan sus indicadores locales de carga inicial, y enviar mensajes continúa siendo una operación visible. Otras futuras consultas silenciosas deben pasar la misma opción.

Verificación: `npm run test:loading` comprueba arranque, recursos, búsquedas, eventos, errores, botones, solicitudes silenciosas, conversaciones, movimiento reducido y ancho móvil. `npm run build` verifica el paquete de producción.
