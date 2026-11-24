# Revisión de pantalla experimental — 23 noviembre 2026

Cambios locales: importación JSON con límite de 10 MB y 500 registros, validación previa y combinación sin sobrescribir claves existentes; exportación conserva metadatos; lector de diagnósticos conserva procedencia, grupo visible, correcciones y evidencia. Bloqueo de controles durante solicitudes, foco en errores y mensajes de conexión comprensibles. Ajustes de separación y adaptación de botones.

Ejecutado:
- `node Backend/scripts/check-search-feedback.cjs`: correcto. Conservación completa exportar/importar; conservación en lector diagnóstico; correcciones; conflicto sin sobrescritura; rechazo de JSON inválido, claves duplicadas, consulta vacía y exceso de registros.
- `node --check Backend/scripts/search-lab-ui/lab.js`: correcto.
- `node --check Backend/scripts/search-diagnostics.cjs`: correcto.
- `git diff --check`: correcto.
- Navegador local 1280 × 850: apertura, envío con Enter de «Necesito una iglesia en Ñuñoa o Macul; me interesa conocer su historia.», estado ocupado y controles deshabilitados; finalización con campos separados, alternativa de comunas reconocida, botón de confirmación habilitado y foco en revisión. Muestra activa observada: 5 iglesias / 15 fragmentos.

Pendiente: recorrido móvil, consultas completas consecutivas, errores inducidos, importación mediante selector y descarga real desde navegador, evaluación visual de resultados y movimiento reducido. Las pruebas de serialización no sustituyen esos recorridos. No se ha comprobado persistencia de los campos al recargar; actualmente solo las evaluaciones se guardan.

No se modificó la aplicación pública ni se hicieron envíos, commit o despliegue.
