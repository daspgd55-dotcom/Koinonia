# Respuesta institucional — etapa 3

Interfaz propia en `Frontend/src/ChurchOutreach.jsx` y `ChurchOutreach.css`, sin importar estilos/formulario de inscripción ni buscar iglesias. Conserva el acceso mediante enlace y sesión limitada de etapa 2.

## Recorrido

1. Reconocer: nombre y ubicación precargados por servidor; nombre y vínculo de quien responde. No hay edición del destino. Si faltan datos de ubicación se informa sin inventarlos.
2. Proponer: 1–20 representantes con nombre, correo y subrol. «También participaré» incluye automáticamente el nombre de quien responde, pide su correo y función, y cuenta dentro del límite. Desmarcarlo conserva sus campos localmente pero los excluye del envío. No exige que el contacto inicial sea representante ni que los correos sean diferentes del destinatario.
3. Revisar: resumen con botones para editar, declaraciones, textos versionados y comunicaciones del trámite. La confirmación distingue recepción de aprobación; no crea cuentas ni asigna permisos.

Cada paso usa formulario nativo, labels y controles de teclado. Los cambios de paso enfocan el título, los errores enfocan un aviso y las filas nuevas enfocan su primer campo. Las declaraciones tienen casilla de tamaño fijo y texto flexible. CSS adaptable y sin movimiento en reduced-motion. No se ejecutó revisión visual ni de teclado en navegador; estas medidas están implementadas, no certificadas mediante pruebas.

El estado React conserva las respuestas al retroceder y ante errores HTTP. No usa localStorage/sessionStorage para datos personales. Recargar, cerrar o abandonar la ruta pierde el borrador; la interfaz lo advierte. Caducar la sesión no borra lo escrito, pero impide enviarlo. No hay recuperación automática del borrador entre enlaces, ni garantía de recuperación de una respuesta HTTP perdida después de confirmar la transacción.

## Contrato de recepción

POST `/api/church-outreach-access/response`, cabecera `X-Outreach-Session`:

```json
{
  "answer": "received",
  "submission": {
    "respondent": {"name": "Nombre", "relationship": "Vínculo declarado"},
    "participates": false,
    "representatives": [{"name": "Nombre representante", "email": "persona@example.org", "proposedSubrole": "editor"}],
    "consent": {"revision": "hash recibido del servidor", "terms": true, "privacy": true, "authorized": true, "communications": true}
  }
}
```

Si participates=true, respondent incluye email y debe existir exactamente una fila con su nombre y correo. La API recorta espacios y normaliza correos a minúsculas, rechaza duplicados y campos desconocidos. Comparte el límite de 20 del modelo. No deduce que dos correos distintos pertenecen a la misma persona ni deduplica contra usuarios existentes: esa revisión sigue siendo administrativa. No exige un subrol administrator en la propuesta.

La recepción guarda respondent, respondentParticipates, proposedRepresentatives y consent en la invitación existente, junto con respuesta/auditoría/revocación de sesión en una transacción. Church y User no se modifican. No se envía correo.

## Textos legales pendientes y bloqueo efectivo

`Backend/src/config/church-outreach-legal.js` mantiene terms y privacy en null. Para habilitar la recepción habrá que incorporar textos definitivos aprobados como `{version, text}` para cada documento. No se incluyen ejemplos como textos reales ni se reutilizan declaraciones del formulario anterior. El cambio requiere revisión del proyecto; no hay interruptor público ni parámetro que permita saltarlo.

El servidor devuelve legal.enabled=false y la UI deshabilita la aceptación documental y el envío. Incluso manipulando el cliente, received no se admite sin configuración completa ni aceptación válida. Las respuestas wrong_church, wrong_contact, declined y no_contact siguen funcionando sin exigir términos para retirarse.

Con configuración completa, el servidor entrega textos/versiones y una revisión SHA-256 conjunta. Al enviar exige esa revisión vigente; si cambió, rechaza sin perder datos en pantalla. Persiste fecha del servidor, versiones, revisión y copia de los textos aceptados, finalidad church_profile_enrichment, declaración de autorización y comunicaciones del trámite. advertising queda false: no hay suscripción publicitaria ni consentimiento publicitario implícito. Esto registra una declaración, no verifica autoridad ni consentimiento individual de las personas propuestas.

## Permisos descritos

Fuente: `Backend/src/services/church-permissions.js` y `Frontend/src/ChurchTeam.jsx`. Administrator administra ficha, contenido, moderación, visitas y equipo; su designación corresponde a admin global. Editor solo contenido de comunidades vinculadas/eventos, no ficha principal ni visitas. Moderator experiencias y visitas. Welcome visitas. Las restricciones adicionales de encargados de visitas siguen aplicándose. No se sustituye automáticamente ningún equipo existente.

Sin pruebas, build, servidor, envíos, cambios de producción, commit ni despliegue. La validación de ejecución y accesibilidad manual queda pendiente por instrucción del usuario.
