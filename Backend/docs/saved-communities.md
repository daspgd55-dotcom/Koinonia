# Iglesias guardadas y comparación

Accesos en Inicio y Mi perfil: #/guardadas. Requiere una cuenta, disponible para los tres roles. Desde esta ruta, iniciar sesión vuelve a Guardadas.

Reutiliza GET /api/users/me/interactions?type=saved&limit=100&page=N y DELETE /api/interactions/:churchId. La lista carga todas las páginas, permite buscar por nombre, comuna o denominación y ordenar por fecha de guardado o nombre. Retirar elimina solo la interacción del usuario autenticado; no descarta la iglesia del recomendador ni elimina su ficha.

La respuesta del listado añade churchId, incluso si church es null por estar despublicada, inactiva o eliminada. No devuelve datos de esa ficha; permite retirar la referencia guardada. Las fichas disponibles mantienen la serialización pública y sus controles de privacidad.

Seleccionar de dos a tres alternativas abre #/guardadas/comparar. La tabla usa datos públicos actuales y distingue ausencia de información de un valor negativo. La selección, búsqueda y orden se conservan en sessionStorage por cuenta; las iglesias guardadas persisten en MongoDB. Las filas de comparación se vuelven a consultar, no se almacenan fichas privadas en el navegador.

Verificación: npm run test:saved en Frontend cubre acceso tras login, ficha no disponible, comparación, regreso con filtro y selección, retirada persistente, fallo de red sin pérdida, estado vacío y accesos desde Inicio/Mi perfil. npm run build verifica compilación; node --test test/api.test.js en Backend verifica permisos y aislamiento de interacciones. Las pruebas usan una base temporal.

La comparación señala Coincidencia, Diferencias, Coincidencia parcial e Información faltante por atributo. Compara valores declarados; las listas se comparan sin depender de su orden. Solo informa coincidencia entre datos disponibles cuando falta información de alguna alternativa. No calcula puntuación total ni propone un ganador. Los elementos comunes de listas diferentes se muestran explícitamente.
