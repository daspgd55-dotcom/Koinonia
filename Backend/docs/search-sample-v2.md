# Preparación incremental local de muestra — v2

Ejecutar desde la raíz del repositorio:

```powershell
node Backend/scripts/prepare-search-sample-v2.cjs --public-dns --limit=100
```

La simulación lee exclusivamente `koinonia_synthetic_test_v2_local`, valida el nombre en MONGO_URI y no muestra la cadena. No crea índices ni colecciones. Usa proyección de campos, serializador público y lista explícita del preparador `church-embedding-document.lab.js`. Excluye inactivas, borradores, fusionadas y la ficha editorial de ejemplo. No incluye equipos, correos institucionales, direcciones exactas ni cuentas. Los textos que contienen patrones de correo, URL o teléfono internacional se apartan para revisión; esto no sustituye una revisión humana de datos personales en texto libre.

Revisar `outputs/search-sample-v2/preview.md` y `preview.json`: selección estable por ID (no aleatoria ni representativa), textos completos públicos, campos, procedencia, versión, hashes, exclusiones, caracteres, documentos nuevos/modificados, reutilizables y retirados. Predeterminado 100 fichas; máximo 1000. Cuenta peticiones de hasta cuatro textos; no inventa duración ni tokens a partir de caracteres.

Después de revisar, generar explícitamente con el mismo límite:

```powershell
node Backend/scripts/prepare-search-sample-v2.cjs --public-dns --limit=100 --generate
```

Requiere Ollama local en 11435 y el digest fijado de embeddinggemma. Cambios de modelo, formato o código invalidan reutilización. La generación vuelve a preparar el plan: si difiere del revisado o cambió el archivo activo, se detiene. Valida vectores y comprueba de nuevo fuente/modelo al terminar; activa por renombrado de un archivo temporal solamente después de completar todo. En errores conserva el activo anterior, que NO debe considerarse vigente sin revalidación. No conectar este archivo directamente a búsqueda pública.

Cada nueva simulación compara contra `active-vectors.json`; el siguiente activo omite documentos retirados (campos ocultos, cambios de selección, fichas fusionadas, borradores o eliminadas). Actualiza procedencia incluso si reutiliza el vector. Church no se modifica. Las simulaciones antiguas y exportaciones ajenas no se purgan automáticamente: pueden conservar textos antes públicos y requieren gestión local separada. No hay observación continua de MongoDB ni garantía frente a cambios posteriores a la última lectura. No ejecutar dos generaciones simultáneas. No hay integración automática con la pantalla actual ni con sus muestras anteriores.

Este bloque ejecuta solo simulación, no generación de embeddings.

Resultado del 23/11/2026: simulación completada, 100 fichas, 1092 documentos, 110103 caracteres, 1092 embeddings pendientes (273 peticiones de cuatro), 0 reutilizaciones y 0 retiradas porque no existe activo v2. node --check y git diff --check correctos. Generación e incremental con vectores reales aún no ejecutados. Primera lectura restringida falló; lectura autorizada fuera del sandbox completó correctamente.
