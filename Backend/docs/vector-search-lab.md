# Laboratorio de MongoDB Vector Search

## Alcance autorizado

Prueba realizada el 17 de noviembre de 2026 en la copia **remota** `koinonia_synthetic_test_v2_local`. El sufijo `_local` no significa que MongoDB se ejecute en el equipo. Se utiliza exclusivamente la colección nueva `rag_embeddings_lab_e2ee2abf4bb4`; el script no carga modelos de la aplicación ni modifica iglesias, cuentas o correos.

Se persistieron 12 documentos sintéticos del laboratorio de embeddings y dos controles adicionales: uno en borrador y otro inactivo. Los vectores proceden de `vectors-2026-11-17T04-31-04-204Z.json`, generados con `embeddinggemma:latest`, 768 dimensiones. El artefacto conserva el digest del modelo y el formato de entrada.

## Ejecución

Desde la raíz del repositorio:

```powershell
# Preparar plan sin conexión a MongoDB.
node Backend/scripts/evaluate-vector-search.cjs

# Crear exclusivamente los recursos sintéticos autorizados.
node Backend/scripts/evaluate-vector-search.cjs --apply --public-dns

# Verificar recursos ya creados sin escrituras en MongoDB.
node Backend/scripts/evaluate-vector-search.cjs --verify --public-dns
```

`--public-dns` es opcional: usa 1.1.1.1 para la resolución DNS de este proceso; no modifica la configuración del sistema. El comando sin argumentos solo genera un plan. `--verify` también escribe un informe local. La URI se lee de `Backend/.env`, nunca se imprime, y se exige el nombre exacto de la base autorizada. No ejecutar contra otro destino ni cambiar esa protección para reutilizarlo en producción.

La colección se deriva del hash del artefacto: un artefacto nuevo genera otro nombre. Repetir `--apply` con el mismo artefacto inserta únicamente documentos faltantes; rechaza datos ajenos o un índice distinto y no borra ni sustituye recursos existentes. No existe limpieza automática.

## Resultado observado

- Plan sin conexión: correcto, 14 documentos previstos.
- Primer `--apply` sin DNS explícito: fallo de conexión `ECONNREFUSED`, antes de crear recursos. Informe `vector-search-2026-11-17T04-46-39-922Z.json`.
- Reintento `--apply --public-dns`: completado, `passed: true`, servidor MongoDB 8.0.37.
- Índice `embedding_cosine_v1`: vector de 768 dimensiones, similitud coseno; filtros `active`, `dataStatus` y `batch`.
- Antes de evaluar filtros se comprobó que los 14 documentos eran recuperables en el índice.
- Las 13 consultas recuperaron los 12 documentos visibles y excluyeron ambos controles.
- Las 13 consultas reprodujeron el orden completo del cálculo local; puntuaciones coincidentes con tolerancia de 0,00001 tras normalizar coseno como `(1 + coseno) / 2`.
- Tiempo observado por consulta: 69–112 ms. Es una muestra pequeña, no un benchmark de capacidad ni una garantía de latencia.

Informe completo: `outputs/embeddings-local/vector-search-2026-11-17T14-38-22-814Z.json`. Plan: `outputs/embeddings-local/vector-search-plan.json`. No se ejecutó por separado el comando `--verify` en esta evaluación; la ejecución `--apply` incluye las comprobaciones descritas.

## Límites y siguiente fase

Se evaluó búsqueda exacta (`exact: true`), no recuperación aproximada ni rendimiento a escala. La coincidencia con el cálculo local verifica el almacenamiento, la consulta y los filtros; **no demuestra que la interpretación semántica sea correcta**. Persisten los problemas de negación y ausencia de coincidencias descritos en `embeddings-local-lab.md`.

No se integró en endpoints, recomendaciones ni interfaz. Tampoco se implementó RAG generativo o sincronización con Church. El siguiente paso es diseñar la colección derivada de fichas públicas revisadas: relación `churchId`, procedencia y hash de contenido, versión de modelo, actualización y retirada de documentos. La recuperación deberá volver a comprobar visibilidad vigente y aplicar requisitos estructurados; el vector por sí solo no garantiza actividades, accesibilidad ni preferencias.

No se ejecutaron pruebas generales, compilaciones, envíos, commits, push ni despliegues. Los recursos sintéticos se conservan para continuar el laboratorio.
