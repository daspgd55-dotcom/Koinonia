# Laboratorio de gestión y consulta de iglesias

## Abrir el panel

Desde PowerShell:

```powershell
cd C:\Users\david\Documents\python\Koinonia\Backend
npm.cmd ci
npm.cmd run dev
```

Conserva tu `.env` actual. Si ya hay un servidor en esa terminal, detén ese proceso con Ctrl+C antes de iniciarlo de nuevo. Usa un solo servidor, `run dev` o `start`. MongoDB debe estar disponible según `MONGO_URI`.

Abre **http://localhost:3000/testing/**. También puedes abrir `/`, que redirige al panel. No hace falta iniciar React, Python ni otro servidor. Con un `PORT` diferente, cambia el puerto de la URL. Si recibes 404, comprueba que reiniciaste el backend actualizado, `NODE_ENV` no sea `production` y `ENABLE_TEST_UI` no sea `false`.

Inicia sesión con tu administrador existente y su contraseña habitual. El panel no crea administradores. Una cuenta `user` solo consulta; un representante consulta y edita sus comunidades; un administrador gestiona todas y es el único que crea, desactiva o restaura. Recargar la página pierde la sesión: el token solo vive en memoria y no se guarda en almacenamiento del navegador.

## Recorrido CRUD reproducible

El panel usa la API real y la base configurada en `.env`: los cambios que hagas aquí sí se guardan. Para este recorrido crea una comunidad ficticia propia, identificada como prueba.

| Paso | Acción | Resultado esperado |
|---|---|---|
| Consulta pública | Abre Catálogo público; busca por nombre o comuna y cambia de página. | Solo aparecen fichas activas publicadas o verificadas. |
| Consulta geográfica | Abre los filtros geográficos e indica latitud, longitud y radio en kilómetros. | Resultados dentro del radio, con distancia; por ejemplo Santiago: latitud -33.45, longitud -70.65. |
| Crear | Inicia sesión, pulsa Nueva comunidad y completa nombre, comuna y coordenadas. | Guarda un borrador y abre su ficha con ID y versión. |
| Consultar borrador | En Gestión privada, busca el nombre recién creado. | Se ve allí aunque todavía no aparezca en el catálogo público. |
| Editar | Cambia descripción y guarda. Cierra y vuelve a abrir la ficha. | Persiste la descripción y aumenta la versión. |
| Validar publicación | Intenta publicar una ficha incompleta. | La API enumera los datos esenciales faltantes. |
| Publicar | Completa dirección, denominación, doctrina, reunión, responsable, fuente y autorización; guarda y pulsa Publicar como administrador. | Aparece en el catálogo público. Para el registro ficticio usa datos explícitamente de prueba. |
| Verificar | Como administrador, pulsa Verificar. | Cambia a verificada. Es una decisión humana, no una validación automática de la información. |
| Desactivar | Pulsa Desactivar y confirma. | Desaparece de la consulta pública y del filtro Activas, pero sus datos se conservan. |
| Restaurar | En Gestión privada selecciona Desactivadas, abre la ficha y pulsa Restaurar como borrador. | Vuelve a Activas en borrador; requiere publicación de nuevo. |

Editar una ficha publicada conserva su visibilidad; una verificada queda publicada hasta nueva verificación. El paso a borrador es explícito. Las iglesias importadas pueden carecer de información institucional requerida para publicar; no inventes esa información para superar la validación.

La eliminación es lógica. Es como sacar una ficha del escaparate y guardarla en el cajón: desaparece para el público, pero puedes recuperarla sin reconstruirla.

## Campos completos y diagnóstico

El formulario cubre los campos habituales; reuniones y horarios se editan como JSON y tienen un botón de ejemplo. En “Otros campos del modelo · editor JSON” puedes editar los demás grupos y pulsar “Aplicar JSON al formulario” antes de guardar. Los campos no visibles se conservan al editar. El documento recibido permite inspeccionar la ficha y su procedencia; los metadatos del importador son de solo lectura.

La asignación de representantes acepta IDs de cuentas activas con rol representante o administrador. El servidor vuelve a comprobar los permisos en cada solicitud; ocultar botones no sustituye esta validación.

El registro de solicitudes muestra método, ruta, estado HTTP y respuesta, ocultando contraseñas y tokens. Si recibes `409 STALE_VERSION`, alguien cambió la ficha desde que la abriste: conserva tus cambios por separado, pulsa Recargar ficha y revisa la versión actual antes de editar otra vez. Los cambios sin guardar requieren confirmación antes de descartarse.

Las imágenes, la presentación final del perfil, recuperación de contraseñas y una consola visual para todos los otros módulos quedan fuera de este panel. Este recorrido cubre autenticación y gestión/consulta de iglesias. En pantallas pequeñas, la tabla se desplaza horizontalmente.

## Pruebas automáticas

```powershell
npm.cmd test
npm.cmd run test:ui
```

Ambos comandos usan MongoDB temporal y no usan tu `MONGO_URI`. No necesitas tener el servidor de desarrollo abierto. La primera ejecución puede descargar el binario de MongoDB; las siguientes reutilizan `.cache/mongodb`.

La prueba de interfaz usa Playwright con Edge instalado en Windows. En otros sistemas instala el navegador con `npx playwright install chromium`. Para elegir Chrome instalado desde PowerShell:

```powershell
$env:BROWSER_CHANNEL = 'chrome'
npm.cmd run test:ui
Remove-Item Env:BROWSER_CHANNEL
```

La prueba crea cuentas e iglesias ficticias en su base temporal, recorre creación, validación, edición, publicación, verificación, desactivación, restauración, conflicto entre sesiones, filtros, paginación y cierre de sesión. Comprueba también el ancho móvil y que no se almacenen tokens en localStorage. Guarda capturas en `.cache/ui-check/desktop-list.png`, `desktop-editor.png` y `mobile.png`. Cierra navegador, servidor y MongoDB temporal al terminar.

`seed.js` vuelve a exigir un administrador activo existente y solo añade los tres registros ficticios si faltan. No crea cuentas, cambia contraseñas ni sobrescribe iglesias existentes. No necesitas ejecutarlo de nuevo para usar este panel.


## Buscar iglesias: filtros y presentación

`GET /api/churches/search` acepta `sort=name|distance`. Sin `sort`, conserva el comportamiento anterior: nombre sin coordenadas y cercanía con coordenadas. `distance` requiere `lat` y `lng`; el radio sigue aplicándose incluso al ordenar por nombre. El orden se calcula en el servidor antes de paginar, con `_id` como desempate.

En escritorio se muestran los filtros laterales; en móvil están cerrados inicialmente y se cierran al aplicar. El nombre y los filtros comparten una búsqueda explícita: los cambios pendientes se indican sin sustituir los resultados anteriores. Las etiquetas permiten retirar un criterio, y retirar una rama retira también su denominación dependiente. El selector de orden se aplica inmediatamente sobre los filtros ya aplicados. Volver desde una ficha conserva la búsqueda.

Las tarjetas usan fotos públicas (banner, instalaciones o imágenes antiguas sin categoría), respetando su punto focal, con ilustración de respaldo si faltan o fallan. Muestran un horario informado y hasta dos actividades. El mapa indica las ubicaciones de la página actual y el total de resultados.

Verificación local: `cd Frontend`, `npm run test:explore`, `npm run build`; en Backend, `npm test`. La prueba de búsqueda utiliza MongoDB temporal y navegador aislado; cubre filtros removibles, datos de tarjetas, orden, paginación, GPS permitido/denegado, mapa sin red, reintento, regreso desde ficha y panel móvil.


## Para ti y navegación móvil

La vista presenta una comunidad a la vez. El resumen de preferencias y el detalle de coincidencias se despliegan a petición; las coincidencias principales, diferencias e información faltante permanecen visibles. Editar preferencias lleva directamente a `#/configuracion`. `Ver otra` no registra una decisión; Guardar y Descartar conservan su comportamiento y permiten deshacer la última acción.

La consulta por descripción es solo un aviso «Próximamente», sin formulario ni llamada a un proveedor. La ruta antigua `#/descubrir/semantica` muestra la misma vista de descubrimiento con el aviso compacto. No cambia el contrato ni el cálculo del recomendador.

Hasta 800 px la navegación mantiene Buscar iglesias, Para ti y Mi perfil (Iniciar sesión para visitantes) a la vista. Menú agrupa Inicio, Administración cuando corresponde, registro o cierre de sesión. Se cierra al navegar, al pulsar Escape o al hacer clic fuera; Escape devuelve el foco al botón.

Ejecutar `npm run test:discover` y `npm run test:explore` en Frontend. Se verifican visitantes y tres roles, explicaciones y datos faltantes, navegación móvil, guardado/deshacer/descarte persistente, Ver otra sin interacción, ausencia de formulario semántico y conservación de contexto.
