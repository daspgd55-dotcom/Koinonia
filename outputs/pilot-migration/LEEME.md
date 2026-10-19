# Migración controlada de iglesias del piloto

## Resultado observado el 18-10-2026

La base origen se llama exactamente `Koinonia_pilot` (K mayúscula). Tiene 2 iglesias. El destino `koinonia_synthetic_test_v2` tiene 338. Ambas iglesias del origen —Iglesia Bíblica Alma e Iglesia Viña Ágape— ya están en destino con los mismos identificadores y valores de ficha. El plan detectó 2 coincidencias, ninguna iglesia nueva y ningún campo de ficha pendiente de sustituir. No se aplicó una migración ni se modificó ninguna base.

## Generar un plan actualizado

Desde la raíz del proyecto:

```powershell
node Backend/scripts/migrate-pilot-churches.js --dns-server 1.1.1.1
```

Usa `MONGO_URI` de `Backend/.env`. Solo lee MongoDB y escribe `outputs/pilot-migration/plan.json`. Detecta el nombre exacto de la base origen; si hay varias coincidencias requiere `--source` con el nombre exacto.

El informe incluye coincidencias, nuevas iglesias, campos que sustituiría, usuarios necesarios que faltan, fuentes y conflictos. No contiene contraseñas ni la URI. Leer `churchChanges` y `blockers` antes de aplicar.

## Qué hace y qué bloquea

- Mantiene los identificadores de las iglesias existentes en destino. Identifica primero por ID y referencias de procedencia; después por nombre y dirección exactos normalizados. Coincidencias ambiguas o varias fichas del origen dirigidas al mismo destino bloquean todo el lote.
- Los valores no vacíos del piloto sustituyen la base histórica o el relleno de la ficha. No se borran valores por vacíos del origen ni se unen listas automáticamente. Una edición posterior en destino diferente del origen y de la ficha inicial genera un conflicto; no se sobrescribe silenciosamente.
- El origen gana donde hay información. El relleno restante conserva su procedencia. Una ficha con atributos sintéticos o inferidos pendientes nunca pasa a verificada por esa mezcla. `metadata.testData` permanece verdadero en la base de pruebas.
- Copia solamente usuarios faltantes referenciados como autores, representantes o responsables de fuentes. Conserva las cuentas existentes y bloquea colisiones de identidad, correo o nombre de usuario. Remapea la membresía de los usuarios nuevos. Membresías existentes sin destino válido se marcan para revisión.
- Copia `church_sources` relacionadas, preservando su estado pendiente/aprobado. Conserva IDs y remapea la iglesia. Bloquea diferencias con un documento del mismo ID ya presente.
- Actualiza la procedencia y retira del corpus RAG sintético los atributos sustituidos para no mantener textos contradictorios. No genera ni actualiza embeddings.
- No importa guardados, descartes, experiencias, visitas, eventos ni comunidades vinculadas del origen. Los datos de destino asociados a una iglesia coincidente conservan su ID de iglesia. No copia todos los usuarios del piloto.

## Aplicar un plan revisado

Solo cuando existan cambios que se quieran aplicar y `blockers` esté vacío:

```powershell
node Backend/scripts/migrate-pilot-churches.js --dns-server 1.1.1.1 --apply --reviewed-hash VALOR_DE_FINGERPRINT
```

`VALOR_DE_FINGERPRINT` es la huella completa del plan que se revisó, sin comillas adicionales necesarias. Si las bases cambiaron, se cancela y se genera un plan nuevo. No usar una huella antigua sin revisar de nuevo.

Antes de escribir guarda un respaldo BSON Extended JSON de las colecciones leídas de ambas bases en `Backend/.cache/migration-backups/`. Incluye información privada y hashes de contraseñas: no compartirlo. Esta carpeta está excluida de Git. No existe una orden automática de restauración en este script; la restauración debe diseñarse según los cambios posteriores para no sobrescribirlos.

La escritura del destino se realiza en una transacción de Atlas; un error la revierte. Se comprueba otra vez la huella dentro de la transacción y se detiene ante cambios concurrentes. El origen no recibe escrituras. En un lote sin cambios de ficha como el observado, no es necesario aplicar; la ejecución con `--apply` de todos modos actualizaría metadatos y procedencia de las coincidencias.

## Validación

```powershell
node --test Backend/test/pilot-migration.test.js
```

Ocho pruebas de lógica cubren identificación, ambigüedad, prioridad, protección de ediciones, usuarios, preservación de marcas de prueba y detección de cambios. Se ejecutó el plan real de solo lectura. La escritura de esta nueva migración todavía no se ha ejecutado en el clúster.
