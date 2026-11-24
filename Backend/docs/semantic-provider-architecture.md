# Puertos de búsqueda semántica — experimental v1

Estado al 23/11/2026: implementado y probado con servicios simulados. No conectado a rutas públicas ni a la pantalla local existente. No cambia `RECOMMENDER_URL`, credenciales, .env, políticas del piloto ni capacidades públicas. El contrato de explicaciones externas de `recommender-contract.md` sigue intacto: el proveedor no decide requisitos, IDs, roles ni permisos.

## Arquitectura

Composición del servidor (`semantic/index.js`) → orquestador (`search.js`) → dos puertos:

- Proveedor: `{identity, embed({items, kind, signal}) → {identity, vectors}}`. `kind` es query/document. Cada adaptador es responsable del formato específico del modelo. Nunca enviar Church completo. Identidad inmutable: provider/model/revision/dimensions/formatVersion/documentVersion.
- Repositorio: `load({namespace, signal}) → {namespace, churches, items}`. Debe obtener una instantánea actual autorizada; `churches` se utiliza internamente para permisos de publicación y requisitos, no se envía al proveedor. `items` lleva `_id`, texto, textHash, embedding. Debe soportar abort, acotar lecturas y devolver solo el corpus correspondiente. La implementación concreta para archivo local/Atlas es el siguiente bloque; no hay escrituras, índices o conexiones MongoDB en esta capa.

El orquestador reconstruye la interpretación desde los dos canales revisados, aplica `prepareChurch` y hashes actuales, comprueba condiciones antes de embeddings y luego apoyo temático. No usa un umbral de similitud. La similitud ordena; no demuestra utilidad humana. Hasta 10.000 fragmentos por instantánea; no es un motor escalable de recuperación remota. Con requisitos incompatibles o sin evidencia no llama al proveedor. Los campos derivados ocultos, borradores y fusiones quedan fuera por validación contra la fuente actual.

La namespace es SHA-256 de identidad canónica. Un cambio de proveedor, modelo, digest, dimensión o formato obliga a corpus distinto; no mezcla vectores. Los archivos sample-v2 actuales no tienen este contrato de namespace: no se adaptan ni activan silenciosamente. Debe crearse un adaptador explícito que valide sus metadatos antes de incorporarlos.

## Configuración del servidor

Variables leídas únicamente por `semantic/config.js`, sin añadirlas a .env ni frontend:

| Variable | Predeterminado / validación |
| --- | --- |
| SEMANTIC_SEARCH_ENABLED | false; solo true/false |
| SEMANTIC_PROVIDER | ollama; otros rechazados como no implementados |
| SEMANTIC_OLLAMA_URL | http://127.0.0.1:11435; solo HTTP loopback sin credenciales |
| SEMANTIC_MODEL_DIGEST | obligatorio al activar; identidad exacta esperada |
| SEMANTIC_TIMEOUT_MS | 10000; 100–240000 |
| SEMANTIC_CONCURRENCY | 1; 1–8 por instancia |

No recibe configuración de body, cabeceras, almacenamiento del navegador o VITE. Crear una única instancia de la fachada por proceso, no una por petición, para compartir el límite. Instanciar proveedores remotos posteriormente requiere adaptador y revisión explícitos; hoy no existe transporte remoto ni clave configurada. Ollama utiliza embeddinggemma y verifica digest antes/después; prefijos query/document conservados, truncate:false, sin redirecciones, respuesta máxima 2 MiB. El laboratorio legado conserva su adaptador y comportamiento.

## Plazos y errores

El plazo engloba carga del repositorio y embeddings. Sin cola; saturación → BUSY. AbortSignal se propaga a ambos puertos. Si un servicio ignora abort, la plaza queda ocupada hasta que termine: no se permite crecimiento ilimitado de trabajos colgados. La respuesta retorna al vencer el plazo. No hay reintentos automáticos ni cambio silencioso de modelo/proveedor. Los límites son por instancia/proceso, no distribuidos.

Errores controlados: DISABLED, BUSY, TIMEOUT, CANCELLED, UNAVAILABLE, RATE_LIMITED, INVALID_RESPONSE, RESPONSE_TOO_LARGE, MODEL_MISMATCH, CORPUS_MISMATCH, INVALID_CORPUS. Detalles internos de excepciones de red/repositorio no salen en la respuesta. No se registran consultas ni secretos en esta capa.

## Respuesta y degradación

- `needs_clarification`: revisión inválida o condiciones no interpretables; no consulta servicios.
- `unavailable`: mantiene intent y review; resultados vacíos, código explícito, `fallback.allowed:false`. Sugiere abrir búsqueda tradicional y confirmar filtros por separado. Nunca ejecuta esa alternativa ni elimina condiciones para obtener resultados.
- `available`: grupos `accepted`, `held`, `exploratory`, evidencias, namespace y cantidad de documentos retirados. `held.validation.status=unknown` significa falta de información; `not_satisfied`, dato incompatible. `exploratory` significa condiciones superadas pero interés sin apoyo suficiente. Array `results` se mantiene vacío: consumidores deben usar los grupos explícitos, no asumir una lista única.

No interpreta ni responde como un chatbot; no genera explicaciones LLM. Recibir `available` no prueba exhaustividad de la muestra ni validez institucional.

## Verificación ejecutada

`node --test Backend/test/semantic-ports.test.js`: primera ejecución 16/16; ampliación final 19/19. Servicios y fetch simulados en memoria, sin MongoDB, Ollama ni proveedores remotos.

Cobertura: apagado por defecto; configuración inválida/remota rechazada; namespace por seis dimensiones; conservación de revisión; condición desconocida; éxito con evidencia; comuna incompatible; falta de información; abstención temática; inactiva/borrador/fusión/texto cambiado; corpus incompatible; vectores no finitos y versión cambiada; error sin secretos; timeout con plaza retenida; cancelación antes/durante; prefijos Ollama y digest antes/después; HTTP/JSON inválido; campo oculto; fachada apagada sin dependencias; timeout global del repositorio.

`git diff --check`: correcto. No se ejecutó suite global ni build frontend (no hay cambios frontend en este bloque).

## Pendiente antes de producción

1. Adaptador local de corpus v2 y conexión optativa del laboratorio a esta fachada; pruebas integradas con la copia autorizada y revalidación de frescura.
2. Recuperación paginada/vectorial con límites de memoria, cancelación real del driver, publicación y permisos; política de antigüedad y concurrencia de snapshots. Una lectura actual no garantiza que no cambie una ficha inmediatamente después.
3. Elegir proveedor/hosting y evaluar tratamiento de consultas, región, retención, costes, credenciales y disponibilidad. Ninguno contratado o invocado aquí.
4. Para otro modelo: revisar prefijos, dimensión, métrica, revisión inmutable y regeneración del corpus; evaluar pertinencia y regresiones. No basta cambiar URL.
5. Límites por usuario/IP y distribuidos, métricas saneadas, disponibilidad/alertas, carga concurrente y despliegue gradual. La activación por env no debe habilitar una ruta pública hasta completar estos pasos.
6. UI accesible de indisponibilidad/reintento y opción tradicional explícita; completar recorridos de escritorio/móvil pendientes del laboratorio.
