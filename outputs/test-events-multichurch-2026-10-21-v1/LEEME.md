# Cuarenta eventos adicionales en veinte iglesias

Lote `test-events-multichurch-2026-10-21-v1`, insertado el 21-10-2026 en `koinonia_synthetic_test_v2`. Son 40 publicaciones nuevas, dos por iglesia. Iglesia Bíblica Alma está excluida por ID y por nombre. Sus diez eventos anteriores permanecen sin cambios; el total comprobado de la base es 50.

## Cobertura

| Dimensión | Distribución |
|---|---|
| Iglesias | 5 parroquias católicas, 2 bautistas, 3 presbiterianas, 4 pentecostales, 3 adventistas, 1 metodista, 1 anglicana y 1 Asamblea de Dios |
| Modalidad | 26 presenciales, 8 en línea y 6 híbridos |
| Participación | 24 libres, 12 con inscripción y 4 por invitación |
| Estado inicial | 32 programados, 4 pasados recientes y 4 cancelados |
| Categoría | 11 talleres, 8 encuentros, 7 de servicio comunitario, 5 culturales, 4 de evangelismo, 3 retiros y 2 recreativos |
| Colaboraciones | 3 aceptadas y 2 pendientes, siempre entre iglesias de la misma tradición |

Se seleccionaron congregaciones con nombre e identidad concordantes. Se excluyeron asociaciones, oficinas administrativas, fichas de control sin denominación y coincidencias nominales ambiguas. La coherencia es la de un escenario ficticio; no verifica datos ni actividades de una iglesia real.

Los temas son distintos: catequesis familiar, oración, salmos, lectura bíblica, solidaridad, acogida, historia de la Reforma, himnos, convivencia, servicio, bienestar y retiros. Las actividades adventistas se fijaron en sábado. Los retiros son presenciales y duran ocho horas. Las sedes, comunas y coordenadas se conservan desde las fichas, sin inventar desplazamientos a otras comunas.

## Publicación y procedencia

Las veinte fichas ya estaban activas y publicadas como datos de prueba, pero carecían de `metadata.firstPublishedByAdminAt`, requisito para publicar y editar eventos. Se habilitó esa publicación inicial como simulación administrativa, exclusivamente en esta base, con respaldo previo. Se incrementó la versión de cada ficha y se registró actor y fecha. No se cambiaron nombres, identidades, representantes ni `verification.authorized`; la habilitación no certifica información institucional.

El manifiesto en `test_batches` guarda selección de iglesias, IDs de eventos, actor, habilitaciones simuladas y ruta del respaldo. Las descripciones identifican cada evento como publicación ficticia. Los historiales de colaboración también son simulados. Las relaciones aceptadas mantienen una única iglesia propietaria; una invitación pendiente no aparece como colaboración confirmada.

Cada evento incluye descripción, categoría, público, fechas con zona, modalidad, sede o sala virtual, condiciones y contacto. Las inscripciones incorporan instrucciones y, cuando corresponde, formulario. Los correos, formularios y salas bajo `koinonia.test` son ficticios. Algunas portadas reutilizan imágenes heredadas de la ficha, identificadas como tales; no son fotografías de eventos ocurridos.

## Pruebas en la aplicación

- En Eventos, usar Próximos para los programados y cancelados de fechas futuras; Todos para la distribución completa al momento de la carga; Pasados para los cuatro del 20 de octubre.
- El código actual del directorio público conserva eventos terminados durante 72 horas. Los cuatro pasados dejarán ese listado después de esa ventana, aunque sus documentos e historial de gestión permanezcan. No fueron eliminados.
- Probar filtros de categoría, público, fechas, modalidad en ficha, condiciones de participación y privacidad de contacto. Los usuarios comunes pueden marcar sus propias intenciones; no se insertaron participaciones por ellos.
- Probar la aparición pública de las tres colaboraciones aceptadas y la ausencia de las dos pendientes como confirmadas. Solo el propietario y administradores conservan permisos de edición.

## Archivos y validación

- `LISTADO.md`: los cuarenta eventos con iglesia, fecha y horario de Santiago.
- `events.json`: documentos completos.
- `plan.json`: selección y cobertura del lote.
- `verification.json`: comprobación pública, IDs, totales y respaldo.

El primer pase insertó 40 documentos; el segundo insertó 0, conservando los mismos 40 sin sobrescribirlos. Por eso el último informe tiene `inserted: 0`. Se comprobaron 40 fichas públicas y 40 resultados del directorio real del controlador, 20 iglesias distintas, colaboraciones correctas y preservación de los diez eventos anteriores.

Cinco pruebas locales validaron exclusión de Alma, identidad de congregaciones, títulos e IDs únicos, esquema/publicación, fechas adventistas, retiros, estados, colaboraciones y selección reproducible. No se ejecutó un recorrido visual de Render. No se modificaron los archivos de interfaz o controladores que tenían cambios previos en el repositorio.

Para inspeccionar sin escribir:

```powershell
node Backend/scripts/create-more-test-events.js --dns-server 1.1.1.1
```

La opción `--apply` solo carga el lote en la base sintética fijada en el script. Una repetición mantiene los IDs y la selección guardada; no restablece ediciones del usuario. El respaldo se conserva en `Backend/.cache/test-event-backups/` y está excluido de Git. No se incluye una orden de borrado o restauración automática.
