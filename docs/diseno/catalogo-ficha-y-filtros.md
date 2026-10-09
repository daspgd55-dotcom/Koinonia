# Ficha institucional como base de opciones y filtros

Fuente revisada: `C:/Users/david/Downloads/Ficha Iglesia - Formularios de Google.pdf`, 21 páginas, exportación del 3 de octubre de 2026. Sus preguntas son un instrumento institucional, no instrucciones de implementación ni datos de una comunidad real. Las opciones transcritas están en `Frontend/src/catalog.js`.

## Incorporación breve

1. Qué busca la persona (pregunta inicial conservada).
2. Rama: Católica, Ortodoxa, Protestante, Rama Independiente y Ninguna de las anteriores.
3. Denominación: opciones según rama y Sin una denominación específica; permite Otra denominación.
4. Ubicación: comuna, dirección opcional, casilla para activar ubicación y deslizador 1–50 km. Finaliza directamente, sin otro paso de revisión.

Las opciones de ausencia se guardan como `answerStates.no_preference` y no como etiquetas de rama/denominación. No se infiere pertenencia religiosa, doctrina ni restricciones a partir de otra respuesta. Ninguna de las anteriores no significa Rama Independiente.

## Procedencia y alcance

| Información | Páginas / preguntas | Aplicación actual |
|---|---|---|
| Comunas | 4–5, P13 | Sugerencias editables; Barnechea → Lo Barnechea, Santiago (Centro) → Santiago |
| Ramas | 7, P18 | Cuatro opciones del formulario + ausencia explícita |
| Denominaciones | 8, P19 | Once opciones del formulario, agrupadas para navegación |
| Doctrina, valores y prácticas | 9, P23 | Trece etiquetas en configuración |
| Idiomas | 10, P24 | Español, Inglés y entrada para otros |
| Ministerios | 17, P46 | Quince opciones en configuración |
| Actividades | 18, P47 | Trece opciones en configuración |
| Grupos etarios | 18, P49 | Seis opciones en configuración |

El formulario no vincula explícitamente cada denominación con una rama. La agrupación del cliente propone Católica Romana bajo Católica, opciones de tradición protestante bajo Protestante, y Evangélica/No Denominacional bajo Rama Independiente. Es una ayuda de navegación revisable, no una clasificación doctrinal verificada. El formulario no enumera denominaciones ortodoxas; se ofrece Otra denominación sin inventar una lista atribuida al PDF. Con Ninguna de las anteriores se muestra la lista completa. Se conservan selecciones antiguas y personalizadas aunque no pertenezcan al grupo mostrado, identificándolas como guardadas para que el usuario las revise.

## Configuración detallada

Las actividades, ministerios, grupos, doctrina, idiomas, días y primera visita viven en Configuración del perfil. Cada grupo de preferencias admite una casilla «Usar este valor como una restricción». Desmarcada significa preferencia. La incorporación inicial no muestra este control. Los datos anteriores no se eliminan; los valores fuera del catálogo continúan editables.

## Candidatos para filtros posteriores

Prioridad alta: comuna/cercanía, rama/denominación, reuniones por día y horario, actividades/ministerios, idioma y accesibilidad. A continuación: modalidad de reunión, público objetivo y etiquetas doctrinales declaradas. Calidad, fuente y fecha deben acompañar resultados, sin equivaler a calidad espiritual.

El catálogo conserva además los valores de soteriología, escatología, tipos de reunión, modalidades y rangos de miembros (pp. 7 y 10–11). Son candidatos, no filtros activos de esta entrega. Su incorporación requiere definir correspondencia con campos de iglesia, disponibilidad real de datos y semántica de ausencia. Accesibilidad «parcialmente» y estacionamiento «depende del sector» no deben convertirse sin revisión en booleanos del modelo actual.

No se priorizan filtros por nombre del pastor, redes sociales, teléfono o correo. Son información de ficha o contacto. Descripciones doctrinales libres permanecen como contenido institucional; las opciones del formulario no prueban que una iglesia cumpla una característica.
