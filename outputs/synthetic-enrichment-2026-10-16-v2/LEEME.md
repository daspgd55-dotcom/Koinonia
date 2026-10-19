# Lote de prueba v2: inferencia explícita y variación concordante

336 fichas históricas reconstruidas; 302 enriquecidas y 34 controles sin enriquecimiento. El lote añade 3.863 valores sintéticos y 142 valores inferidos. Hay inferencias por nombre en 73 fichas. No se consultaron páginas de iglesias para verificar estos valores.

## Prioridad de los criterios

1. Conservar cada campo preexistente, incluyendo ubicación, contactos y textos originales. Lo heredado se marca `inherited_unverified`, no se certifica como real. El respaldo incluye una comunidad DEMO ficticia previa.
2. Cuando existe denominación, completar la rama solo si hay una correspondencia contemplada en las reglas. Marcar `existing_data_inference`.
3. Leer pistas explícitas en el nombre para campos vacíos: Presbiteriana, Bautista, Luterana, Adventista, Anglicana, Asamblea de Dios, Pentecostal, Metodista, Ortodoxa, Católica, Parroquia, Basílica y No Denominacional. Priorizar Metodista Pentecostal sobre Metodista. Marcar `name_inference`; estas reglas son heurísticas, no pruebas institucionales.
4. Si un dato existente contradice una pista del nombre, conservarlo y señalar el conflicto en `issues`. No completar una denominación incompatible con la rama existente. Identidades explícitas fuera del catálogo, como Santos de los Últimos Días, no reciben una rama al azar.
5. Sin pistas de identidad, asignar una combinación de rama y denominación de prueba, compatible con la rama existente si la hay. Marcar `synthetic`.
6. Generar atributos variados con selección reproducible mediante hash del identificador y del atributo. Las combinaciones sirven para cobertura técnica; no representan frecuencias reales ni probabilidades estadísticas de pertenencia.

Las 34 fichas de control no reciben inferencias ni relleno, incluso cuando el nombre ofrece una pista; permiten probar ausencias.

## Variación y concordancia del relleno

- Entre 1 y 7 ministerios cuando el campo está vacío; actividades relacionadas con esos ministerios y grupos de edad relacionados cuando hay una correspondencia.
- Idiomas: combinaciones de Español con Inglés, Portugués o Creole haitiano. Son simulaciones; el nombre o la ubicación no verifican el idioma.
- Estilos musicales compatibles con el estilo cultural del escenario. No se atribuyen como rasgos reales de una denominación.
- Doctrina: listas acotadas por el escenario para evitar contradicciones obvias. Por prudencia el generador no añade Bautismo infantil ni Eucaristía a escenarios protestantes, aunque eso no describe exhaustivamente esas tradiciones. No es un modelo teológico ni una taxonomía validada.
- Reunión principal simulada semanal: Misa en escenario católico, Divina liturgia en ortodoxo, Culto principal en los demás. Adventistas: sábado; otros: domingo. Son convenciones de prueba, no horarios reales deducidos. Entre 0 y 3 reuniones adicionales con frecuencia semanal, quincenal o mensual.
- Diez horarios principales, cinco duraciones y ocho rangos de miembros; accesibilidad, estacionamiento y bienvenida incluyen valores desconocidos.
- No se generan teléfonos, correos, líderes, testimonios, URL institucionales ni declaraciones oficiales. Los contactos originales permanecen heredados y no verificados.

268 fichas reciben el tratamiento amplio y 34 uno parcial; esto no garantiza completitud absoluta. Los casos de control suman otras 34. Las reuniones o listas preexistentes se conservan completas, sin añadir elementos.

## Archivos y procedencia

- `churches.test.ndjson`: formato `koinonia.test-fixture.v2`. El objeto `church` respeta el contrato actual de la aplicación.
- `rag.test.ndjson`: corpus marcado como sintético de prueba; diferencia cada valor INFERIDO de SINTÉTICO y enlaza la ficha por ID.
- `report.json`: cantidades, conflictos, cobertura, fuentes y hashes.

`enrichedFields` enumera todos los campos añadidos; `syntheticFields` solo el relleno y `inferredFields` las inferencias. `fieldProvenance` guarda origen, regla y estado no verificado. Cada ficha conserva `testOnly: true`, `batchId` y `verification.source: synthetic_test_unverified`. Las coordenadas e identidades originales no se modifican.

El corpus no es evidencia institucional ni un índice vectorial. Sirve para ensayar recuperación, trazabilidad y fidelidad a datos de prueba; no permite demostrar pertinencia real de recomendaciones.

## Generación e importación

Desde la raíz del proyecto:

```powershell
node Backend/scripts/build-test-dataset.js
node --test Backend/test/test-dataset.test.js
node Backend/scripts/import-test-dataset.js
```

El último comando solo valida el lote y muestra el plan, sin conectarse. Para escribir se utiliza:

```powershell
node Backend/scripts/import-test-dataset.js --apply
```

La conexión se toma de `Backend/.env` (`MONGO_URI`) sin imprimirla. El destino está fijado a **koinonia_synthetic_test_v2**, dentro del mismo clúster. No se escribe en la base original configurada en la URI.

La importación valida los modelos de Mongoose antes de conectar, rechaza registros ajenos al lote en las colecciones de destino y utiliza una transacción para cargar:

- `churches`: 336 documentos compatibles con el modelo, `metadata.testData: true` e `importInfo.batchId`.
- `test_fixture_provenance`: fichas completas con origen por campo.
- `rag_test_documents`: corpus de prueba, separado de fuentes institucionales.
- `test_batches`: manifiesto del lote.
- `users`: autor técnico inactivo, sin una contraseña conocida ni credenciales de acceso entregadas.

Una segunda ejecución reconoce el manifiesto completo y comprueba cantidades sin duplicar el lote. Los ID se derivan de lote e identidad original. La aplicación no cambia automáticamente de base: para usar estas iglesias se requiere una instancia de pruebas apuntando a esta base y usuarios de prueba. El corpus tampoco se indexa automáticamente. La retirada debe limitarse a esta base exclusiva; no se incluye una rutina de borrado.

## Estado comprobado el 16-10-2026

Generación, validación local de las 336 fichas y ocho pruebas completadas. Se encontró una URI de Atlas configurada. La lectura de conectividad falló con timeout y, tras autorizar acceso de red, ECONNREFUSED. No se verificaron los permisos de escritura ni se ejecutó la importación al clúster. No se necesitan nuevas credenciales hasta aclarar la conectividad; un error de autenticación posterior permitiría determinar si hay que actualizar la configuración.

### Actualización del 17-10-2026: importación completada

Se identificó el fallo en `querySrv`: el DNS configurado (`127.0.0.1`) rechazaba las consultas. Se añadió `--dns-server` al importador; modifica únicamente el resolvedor del proceso Node, sin cambiar Windows. Con el comando siguiente la importación finalizó correctamente:

```powershell
node Backend/scripts/import-test-dataset.js --apply --dns-server 1.1.1.1
```

Destino confirmado: `koinonia_synthetic_test_v2` en el clúster configurado. Conteos finales comprobados: 336 iglesias, 336 fichas de procedencia y 336 documentos RAG. Nueve pruebas locales pasaron. No se cambiaron la base original ni la configuración de conexión de la aplicación. Para usar estas iglesias desde la aplicación aún se requiere una instancia de pruebas que apunte a esta base y tenga sus propios usuarios.
