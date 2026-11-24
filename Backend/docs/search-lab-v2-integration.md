# Integración local v2 — 23/11/2026

Se implementó `semantic/local-repository.js` y el servidor independiente `scripts/serve-search-lab-v2.cjs`, que reutiliza la pantalla experimental. El servidor anterior en 4600 se conserva. El nuevo usa 4601, solo loopback, Host/Origin exactos y NODE_ENV distinto de production.

Arranque desactivado por defecto (no lee MongoDB ni llama Ollama):

```powershell
node Backend/scripts/serve-search-lab-v2.cjs
```

Para habilitar posteriormente, en la sesión del servidor, después de revisar/generar la muestra según `search-sample-v2.md`:

```powershell
$env:SEMANTIC_SEARCH_ENABLED='true'
$env:SEMANTIC_MODEL_DIGEST='85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1'
node Backend/scripts/serve-search-lab-v2.cjs
```

No se modificó .env ni se activó esta configuración. El adaptador solo acepta `koinonia_synthetic_test_v2_local`; lee `outputs/search-sample-v2/active-vectors.json`, sin crear colecciones/índices. Comprueba esquema, base, identidad/digest/dimensión/formato, hashes de código generador/serializador/preparador, texto, entrada de embedding, IDs únicos y vectores finitos. Consulta las fichas actuales con proyección y límite de tiempo. El orquestador vuelve a aplicar publicación, fusiones, campos ocultos y hashes antes de mostrar evidencia. Propaga cancelación y procedencia a exportaciones. La lectura actual no evita cambios posteriores en la base.

Actualmente no existe active-vectors.json: muestra CORPUS_NOT_GENERATED, sin generar nada y sin leer fichas. Una vista previa no se convierte en corpus automáticamente. Los fallos preservan campos y condiciones, enfocan el aviso y ofrecen reintento. La saturación devuelve HTTP 429; indisponibilidad 503. Ningún error activa búsqueda tradicional silenciosamente.

## Comprobaciones

- `node --test Backend/test/semantic-ports.test.js Backend/test/semantic-v2.test.js`: 26/26. Primer intento: tres pruebas HTTP bloqueadas por EACCES del sandbox; repetición autorizada fuera del sandbox: todas correctas. Servicios en memoria, sin proveedor real.
- `node Backend/scripts/check-search-feedback.cjs`: ocho comprobaciones correctas de formato, conservación, duplicados, límites y errores.
- `node --check Backend/scripts/search-lab-ui/lab.js`: correcto.
- Navegador real contra `serve-search-lab-qa.cjs` (4602), con dos fichas/vectores simulados, sin .env/MongoDB/Ollama. Saturación inducida, foco en error, campos preservados, botón de reintento, estado de carga y controles bloqueados; consulta completada y foco en resultados.
- Consulta original: «Necesito una iglesia en Ñuñoa; me interesa ayudar.»; interés corregido a «ayuda social». Condición mantenida. Exportación real desde navegador: JSON revisado, conserva consulta, corrección, displayGroup=accepted, modo interest, systemVersion, planHash y namespace.
- Importación del archivo exportado: 0 añadidas/1 clave conservada. Importación de copia con clave de QA nueva: 1 añadida/0 sobrescritas. No se borraron evaluaciones del usuario; QA usa origen distinto 4602.
- Segunda consulta consecutiva en móvil: interés «atención neurológica gratuita». Abstención temática separada de falta de evidencia de comuna. Desplegable abierto con Enter.
- Vista 390×844: sin desbordamiento horizontal (scrollWidth 375). Escritorio 1280×850: sin desbordamiento (scrollWidth 1265). Tab desde interés lleva a Actualizar interpretación, foco visible. Capturas `outputs/search-lab-v2-qa/mobile.jpg` y `desktop.jpg`. Tamaño del navegador restaurado.
- Movimiento reducido: revisión estática de CSS, no animaciones/transiciones añadidas y regla existente reduce conserva scroll auto; no se emuló preferencia del sistema.

## Límites y siguiente bloque

No se ejecutó una consulta real con corpus v2 porque los embeddings aún no se generaron. No se generaron embeddings ni hubo escrituras remotas. El servidor QA es exclusivo de pruebas y nunca debe montarse en app.js. Persisten evaluaciones, pero el formulario no se restaura después de recargar (conservación comprobada dentro de la sesión ante errores y consultas consecutivas). No es una auditoría exhaustiva de lector de pantalla ni de dispositivos físicos.

Siguiente paso: revisar la vista previa de 100 fichas, autorizar explícitamente la generación local, generar/validar el activo y medir consultas reales en v2 con casos reservados. Mantener desactivada la aplicación pública.

Comprobación real de fuente: node Backend/scripts/check-v2-preview-source.cjs. Lectura autorizada en koinonia_synthetic_test_v2_local: 100/100 fichas encontradas, 1092/1092 fragmentos de la vista previa mantienen hash público actual. Primer intento restringido falló; repetición autorizada completó. Sin embeddings ni escrituras. Resultado en outputs/search-lab-v2-qa/source-check.json. git diff --check correcto.
