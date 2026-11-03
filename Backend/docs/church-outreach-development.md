# Ajustes del trámite y excepción sintética

El formulario mantiene tres pasos. Los representantes se editan en fichas plegables, una abierta a la vez, con resumen y contador. El listado tiene desplazamiento propio para evitar que veinte fichas alarguen toda la página. Las fichas cerradas se validan antes de continuar y se abren si falta información. El reporte de problemas queda fuera del formulario en una sección independiente; su acción indica expresamente que cierra la invitación y no envía el equipo.

Mientras no existan documentos legales definitivos, el servidor permite enviar propuestas sólo cuando la conexión activa se llama exactamente `koinonia_synthetic_test_v2`. Puede desactivarse con `OUTREACH_SYNTHETIC_LEGAL_BYPASS=false` en el backend. No depende de parámetros, cabeceras ni almacenamiento del navegador. No se habilita por NODE_ENV ni para otras bases.

La respuesta del servidor incluye `testBypass: true` y una revisión de prueba. La interfaz omite las casillas de términos y privacidad pendientes y muestra el aviso de prueba. Sigue exigiendo autorización para compartir la propuesta y comunicaciones del trámite. Se persiste `consent.testBypass: true`, sin versiones ni textos legales inventados. Fuera de esa excepción, el servidor exige ambas aceptaciones. La excepción no habilita el correo institucional ni altera permisos, aprobación, MFA o aceptación individual.

Para usar estos cambios en Render deben desplegarse frontend y backend. Una sesión iniciada con el código anterior necesita un enlace nuevo si ya se consumió o venció; la política y revisión se vuelven a comprobar al enviar. No se modificaron variables de Render ni se desplegó desde esta tarea.

No se ejecutaron pruebas ni compilación en esta modificación. Las evidencias de la verificación anterior no certifican esta nueva interfaz ni la excepción sintética.
