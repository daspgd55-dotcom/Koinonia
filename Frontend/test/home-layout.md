# Inicio público

El inicio consulta `/churches/search?limit=2&view=card` y `/events?view=upcoming&sort=date&limit=2` sin token. Reutiliza la visibilidad y proyección pública del servidor, sin consultar endpoints administrativos. No hay fichas inventadas ni cifras promocionales. Los bloques sin datos se ocultan; los fallos ofrecen reintento y no impiden usar los accesos principales.

Acción principal: Buscar iglesias. Secundaria: Ver eventos. El alcance inicial es Santiago y ambas consultas están disponibles sin cuenta. El acceso contextual de representantes usa Administración para roles autorizados e Inicio de sesión para visitantes. No otorga permisos nuevos.

Verificación: `node Frontend/test/home-layout.cjs` (API simulada, datos presentes/ausentes, errores, reintento, rutas, teclado, anchos 320/390/1440) y `npm --prefix Frontend run build`. Sin consultas ni cambios a datos de producción.
