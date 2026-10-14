# Comparación fuera del lanzamiento

La interfaz de comparación está desactivada para todos los roles mediante `comparisonUiEnabled=false` en `src/Saved.jsx`. No hay selección ni botón para comparar; las visitas a `#/guardadas/comparar` regresan a `#/guardadas`, incluso con una selección antigua en el almacenamiento de sesión. Guardar, consultar, buscar, ordenar y retirar iglesias siguen disponibles.

Se conservan la tabla, los atributos y `src/comparison.js`, con sus pruebas, para reutilizarlos en futuras consultas LLM. Esa integración aún no está implementada: deberá consumir únicamente atributos públicos y mantener coincidencias, diferencias e información faltante sin clasificar comunidades de forma absoluta. No se habilita una excepción mediante URL, rol o almacenamiento del navegador.

Verificación: `npm run test:saved`, `npm run test:comparison` y `npm run build`.
