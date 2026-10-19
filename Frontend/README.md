# Koinonía · Aplicación web

React + Vite, conectada a la API Node existente. Implementa inicio, registro, login, encuesta inicial de tres fases, reanudación, configuración detallada del perfil y exploración pública de iglesias. La paleta acordada y el logo original se usan desde recursos locales; no carga fuentes, imágenes ni bibliotecas desde CDN.

## Ejecutar

Requiere Node compatible con el backend y dependencias instaladas en ambos proyectos. Desde `Backend`, iniciar la API con `npm.cmd run dev` (usa la configuración `.env` existente y MongoDB). En otra terminal:

```powershell
cd C:\Users\david\Documents\python\Koinonia\Frontend
npm.cmd ci
npm.cmd run dev
```

Abrir http://127.0.0.1:5173. Vite redirige `/api` a `http://127.0.0.1:3000`. Si la API usa otro puerto, establecer `API_TARGET` antes de iniciar Vite. Nunca colocar JWT_SECRET ni credenciales de MongoDB en variables de frontend.

`npm.cmd run build` genera `dist`. En un despliegue, servir ese directorio y redirigir `/api` al backend mediante el servidor web. Las rutas de navegación usan hash y no requieren fallback de rutas. `npm.cmd run preview` permite inspeccionar el build, pero requiere configurar un proxy `/api` para utilizarlo con un backend.

## Comportamiento

- El registro se sigue de login. Si la cuenta se crea pero login falla, la pantalla lo comunica y ofrece iniciar sesión, sin repetir el registro.
- La sesión se almacena en sessionStorage de la pestaña; no se guardan contraseñas. Al recargar, GET `/users/me` valida la sesión antes de mostrar datos privados.
- El borrador se conserva en sessionStorage separado por ID de usuario. Las respuestas se guardan en el servidor al continuar, completar o posponer. Cerrar la pestaña puede eliminar lo que no se haya confirmado; se avisa al salir con cambios pendientes. Si el almacenamiento del navegador está restringido, se sigue trabajando en memoria.
- Cerrar sesión guarda cambios pendientes antes de salir; si falla, conserva la edición y muestra el error. Una salida correcta borra el borrador local del usuario y el token. Los avances confirmados permanecen en el servidor.
- Una sesión expirada vuelve al acceso y conserva el borrador de ese usuario para recuperarlo tras autenticarse de nuevo.
- PATCH `/users/me` incluye solo campos editados y expectedRevision. Ante un conflicto se ofrece recargar, conservar las ediciones y revisarlas antes de guardar de nuevo.
- La encuesta inicial pregunta qué busca la persona, rama, denominación dependiente de la rama y ubicación. Las respuestas vacías son opciones seleccionables dentro de cada pregunta, sin menús de estado. Todos los criterios nuevos son preferencias. Las restricciones se configuran solo en `/configuracion`, con una casilla por grupo; desmarcada equivale a preferencia.
- Ubicación: comuna con sugerencias, dirección opcional privada y casilla voluntaria para obtener ubicación aproximada. No hay campos ni valores visibles de latitud/longitud. El radio usa un deslizador de 1 a 50 km; para conservar una preferencia antigua mayor, el máximo de esa sesión se amplía al valor guardado. El deslizador no guarda un radio hasta que el usuario lo modifica. Una distancia obligatoria requiere ubicación válida. La dirección no se geocodifica ni se envía a un servicio externo.
- El perfil muestra valores guardados o el borrador pendiente identificado por el aviso. Editar una sección abre la configuración independiente, con categorías para identidad, ubicación, doctrina, actividades, disponibilidad y primera visita. Su guardado no altera el avance de incorporación.
- Los borradores de la encuesta anterior conservan sus respuestas; se reinicia únicamente la posición visual incompatible con los tres fases. Un perfil completado no vuelve a ser obligado a contestar.
- Los criterios legados desactivados con un valor se preparan como preferencias al entrar mediante los controles de configuración; se conservan sus valores y se guardan solo al confirmar.

## Estructura

- `src/main.jsx`: aplicación, navegación, acceso, encuesta y configuración.
- `src/Question.jsx`: opciones seleccionables, ausencia de respuesta, GPS, deslizador y casillas de restricción.
- `src/catalog.js`: opciones de la ficha institucional y atributos candidatos para futuros filtros.
- `src/profile.js`: tres fases, secciones de configuración, recuperación de borradores y conversión al contrato de la API.
- `src/api.js`: solicitudes, tiempo de espera, errores y almacenamiento de sesión.
- `src/styles.css`: identidad visual y adaptación a móvil.
- `public/logo.png`: logo proporcionado por el usuario, sin redibujarlo.
- `test/journey.cjs`: recorrido real en navegador con MongoDB temporal y API existente.

Las opciones son una selección inicial editable, no una taxonomía doctrinal exhaustiva. Los valores anteriores que no figuran entre las opciones se muestran y conservan. La búsqueda estructurada y las fichas públicas están implementadas. Las recomendaciones semánticas y la comparación siguen pendientes.

## Verificar

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:explore
```

Las pruebas reutilizan Playwright y mongodb-memory-server de `Backend/node_modules`, arrancan una API y una base efímera independientes, y no leen ni escriben la base de desarrollo. En Windows utilizan Microsoft Edge. En otros sistemas requieren Chromium instalado para Playwright. La primera ejecución de MongoMemoryServer puede necesitar descargar MongoDB; se reutiliza el binario del backend si existe.

El recorrido verifica registro, acceso, los tres fases, denominaciones por rama, omisiones, ubicación denegada/activada/retirada, deslizador, error de red con reintento, posposición, reanudación tras login y recarga, configuración detallada, conflictos, expiración de sesión, aislamiento de cuentas y ausencia de desbordamiento horizontal en móvil. Las capturas quedan en `.cache/journey/`.

Nota del entorno de trabajo: esbuild requirió ejecución fuera del aislamiento de archivos de Codex para resolver sus dependencias. La compilación y el recorrido se ejecutaron con ese permiso; no es una dependencia adicional de la aplicación.

## Resultado de verificación

Compilación de producción completada. Recorrido de navegador aprobado con API real y MongoDB temporal, incluyendo conservación de borrador, error de red, conflicto de revisión y expiración de sesión. Capturas de escritorio y móvil revisadas visualmente. El frontend puede ejecutarse contra la API de desarrollo existente sin modificar su configuración.

Verificación de la encuesta breve: 35 pruebas del backend aprobadas. Compilación de producción y recorrido completo de la web aprobados con MongoDB temporal. Se verificaron ubicación denegada/activada/retirada, dirección privada, casillas, tres fases, recuperación de borradores de la versión anterior y diseño móvil.

## Exploración de iglesias

- Rutas públicas `#/explorar` y `#/iglesia/:id`. Finalizar o posponer la encuesta redirige a **Para ti** (`#/descubrir`), desde donde se puede reanudar. Mi perfil, en la navegación superior, mantiene el resumen y el acceso a configuración.
- `GET /api/churches/search`: nombre parcial, comuna, rama, denominación, día, actividad, doctrina e idioma. Cada filtro exige coincidencia; los filtros se combinan con AND. Se reutiliza el contrato sin cambios de backend. No se convierten preferencias del perfil en restricciones ni se aplican automáticamente sus datos privados.
- Ubicación obtenida solo por acción expresa, aproximada a tres decimales, mantenida en memoria y enviada a la API como `lat`, `lng`, `radius`. Distancia 1–50 km. Sin GPS se ordena por nombre; con GPS por distancia en línea recta. La comuna y el radio pueden combinarse. Desactivar ubicación retira el criterio geográfico; cambiar de cuenta limpia la búsqueda.
- Lista de 12 resultados por página, en dos columnas de tarjetas en escritorio y una en móvil. Mapa Leaflet con las coordenadas públicas de esa página, marcadores que abren fichas, atribución visible y aviso si falla la cartografía. Solo se solicitan teselas al abrir la vista mapa, sin precarga ni modo offline. Se puede configurar `VITE_MAP_TILES` antes del build; para otro proveedor debe adaptarse también su atribución. Proveedor inicial: OpenStreetMap, https://operations.osmfoundation.org/policies/tiles/ . Su disponibilidad no está garantizada.
- `GET /api/churches/:id`: identidad, ubicación, accesibilidad, reuniones, doctrina, actividades, ministerios, primera visita y contacto. Enlaces externos limitados a HTTP(S). Cómo llegar abre Google Maps con el destino público, sin enviar dirección privada ni origen del perfil.
- Filtros, página y posición de lista/mapa se conservan en memoria al volver de una ficha durante la misma sesión de la aplicación; una recarga reinicia la búsqueda. Las respuestas del perfil mantienen su propia persistencia existente.
- Las ilustraciones de tarjetas son decorativas, no fotografías de las iglesias. Datos desconocidos se muestran como sin información; horarios externos comerciales no se presentan como horarios de culto. Los registros de prueba se identifican.

### Verificación de exploración

`npm.cmd run test:explore` crea 14 iglesias de prueba exclusivamente en MongoDB temporal y comprueba paginación, búsqueda, filtro por comuna, consulta de ficha, regreso sin perder filtros, GPS denegado/permitido, distancia, marcadores y fallo de teselas, resultados vacíos y reintento de red, escritorio y móvil. No modifica la base de desarrollo. La prueba bloquea las teselas externas deliberadamente: comprueba marcadores y recuperación, no disponibilidad del proveedor. Capturas: `.cache/journey/05-explore-desktop.png`, `06-explore-mobile.png`, `07-detail-mobile.png`.

## Administración de comunidades

El enlace **Administración** y la ruta `#/administracion` están disponibles para representantes y administradores. Los representantes consultan y editan únicamente asignaciones; el admin tiene creación, búsqueda de todas las fichas, publicación/verificación, asignación por correo, baja recuperable y restauración. El editor tiene nueve secciones basadas en el Forms, reuniones/horarios y responsables repetibles, catálogo ampliable y selector de ubicación en mapa. Errores y conflictos conservan el formulario en memoria. Las imágenes/videos se registran mediante enlaces; no hay carga de archivos.

Contrato, permisos, nuevos atributos y recorrido manual: `Backend/docs/community-management.md`. Ejecutar `npm.cmd run test:manage` para la prueba aislada del panel. Nunca se crean cuentas administrativas ni se elevan roles en la base real durante estas pruebas.

## Actualización 2026-10-06

- Solo el registro recién realizado abre automáticamente la encuesta. El login general abre **Para ti**; los accesos iniciados desde eventos, visitas, experiencias, guardadas o colaboraciones conservan su destino contextual. Retomar la encuesta es voluntario desde Para ti, el perfil o el aviso de exploración.
- Incorporación v3: identidad espiritual y objetivo; rama con denominación solo para Protestante/Independiente; ubicación. La identidad espiritual es contexto privado, no un filtro obligatorio.
- Valores legados sin modo explícito se presentan como preferencias. Validar un radio obligatorio sin ubicación solo bloquea al editar distancia/ubicación, no al guardar contexto ajeno. Los valores existentes no se borran.
- Administración permite crear representantes con nombre, correo y cargo. La API fija su rol y genera contraseña inicial; se muestra una sola vez en la respuesta, no se almacena en el navegador. Selección de representantes existentes mediante lista con correo y cargo, paginada en grupos de 100 con Cargar más. Guardar asignaciones confirma la asociación.
- La cuenta ficticia se creó con `Backend/scripts/create-representative-demo.js --create`. El script no reemplaza cuentas existentes. Las credenciales se entregaron en el chat, no se guardan en el repositorio.


Actualización 2026-10-07: administración incluye casillas «Ocultar del perfil público» en soteriología, escatología, correo y teléfono; tipos de reuniones declarados sin horarios; consulta de cuenta por correo y promoción de usuario activo a representante. El recorrido `test:manage` verifica estos controles y su persistencia. La API filtra campos ocultos también fuera de la interfaz.

El admin dispone de una barra de áreas: Comunidades (predeterminada) y Usuarios. Usuarios permite buscar, filtrar y paginar; editar nombre/cargo; cambiar rol y activar/desactivar cuentas, con protección de acceso propio y conflicto de edición. La API restringe estas operaciones a admin.

## Descubrimiento

`#/descubrir` presenta tarjetas con recomendaciones por contenido/reglas para todos los roles autenticados. Visitantes pueden recorrer hasta 20 fichas públicas ordenadas por nombre, identificadas como vista sin personalización. La selección autenticada usa `POST /recommendations` con `mode:traditional`, hasta 20 candidatos; coincidencias/parciales/desconocidos se muestran por criterio, sin presentar el puntaje como probabilidad o valoración espiritual.

Guardar/Descartar persisten mediante `/interactions`; Siguiente solo avanza. Deshacer revierte la última acción confirmada al estado previo. Los descartes quedan fuera de siguientes recomendaciones. Regresar de la ficha completa conserva la tarjeta mientras la aplicación permanece abierta. Una recarga vuelve a consultar. Las imágenes institucionales usan URLs publicadas; cuando faltan o fallan aparece una ilustración decorativa.

`#/descubrir/semantica` es la interfaz de consulta dedicada, con ejemplos y texto conservado entre pestañas en memoria. **LLM/RAG e interpretación semántica no implementados**: informa el estado real y mantiene deshabilitado el envío. No simula resultados ni envía el texto a proveedores. Cambiar de cuenta limpia el texto. `/recommendations/capabilities` informa esta disponibilidad sin revelar configuración interna.

`npm.cmd run test:discover` verifica visitante y tres roles, ranking, ficha/regreso, guardar/deshacer, descarte persistente, adaptación móvil y pestaña semántica pendiente. Capturas `.cache/journey/13-discovery-desktop.png`, `14-discovery-mobile.png`.

## Eventos públicos

`#/eventos` ofrece búsqueda por nombre y comuna, con fechas, categoría, público y eventos pasados en “Más filtros”. Los criterios aplicados aparecen como etiquetas retirables y se conservan en la URL al abrir una ficha y regresar. La cuadrícula usa dos columnas en escritorio y una en móvil; toda la tarjeta abre `#/evento/:id`. La ficha compacta reúne portada ampliable, organizador, fecha y ubicación, seguida de descripción, participación y contacto desplegable. Las imágenes conservan su marco y posición; una portada circular mantiene la relación 1:1 y una imagen que falla se omite.

Verificación: `npm.cmd run test:public-events` usa API y MongoDB temporales y comprueba búsqueda, filtros, fechas inválidas dentro de filtros cerrados, teclado, paginación, privacidad, cancelaciones, imágenes fallidas y los cinco marcos a 1440, 390 y 320 px. Regresiones: `npm.cmd run test:event-participation` y `npm.cmd run test:event-collaboration`. Capturas: `.cache/journey/events-directory-desktop.png`, `events-public-desktop.png` y `events-detail-circle-mobile.png`. Contrato: [Backend/docs/events.md](../Backend/docs/events.md).

## Movimiento y accesibilidad

`PageMotion` conserva la transición entre rutas y aplica apariciones a las secciones de eventos, comunidades, visitas/notificaciones, experiencias, perfil y administración. Las tarjetas (incluidas Buscar iglesias y Eventos) usan **fade-in up** de 480 ms al entrar en pantalla, una vez por elemento durante la ruta actual. Los elementos cargados después de consultar la API también se observan; las tarjetas retiradas se dejan de observar. El desplazamiento animado es independiente del efecto hover.

La preferencia del sistema `prefers-reduced-motion` desactiva los efectos, incluso si cambia con la página abierta. Enfocar un control termina la animación de sus contenedores para conservar el acceso inmediato por teclado. No hay estilos que oculten permanentemente contenido: sin IntersectionObserver el contenido sigue visible. `npm.cmd run test:motion` verifica estos comportamientos con componentes reales en un navegador aislado, sin base de datos ni cuentas.
