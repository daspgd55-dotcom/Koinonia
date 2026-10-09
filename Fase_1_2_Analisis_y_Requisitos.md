# Koinonía — resultados de encuesta, atributos y requisitos iniciales

Fuente: `C:\Users\david\Downloads\Koinonia_Forms.xlsx`. La muestra contiene 47 respuestas; las preguntas de escala tienen entre 44 y 45 respuestas válidas.

## Hallazgos de fase 1

- La utilidad percibida es alta: 4,18/5 de promedio y 34 de 45 personas (75,6 %) la califican con 4 o 5.
- 22 de 45 (48,9 %) visitaron más de una iglesia antes de decidirse. Es evidencia de fricción en el descubrimiento, aunque la dificultad media reportada es moderada (2,66/5).
- 20 de 44 (45,5 %) descartaron una visita por falta de información; otros 11 no lo recuerdan. La información incompleta es una barrera relevante.
- La vía dominante de descubrimiento es familia/amigos (29 de 43 respuestas válidas), seguida muy de lejos por recomendación personal (7). La plataforma debe reducir esa dependencia mediante información comparable y contacto previo.
- Los aspectos que más cuesta evaluar son doctrina/valores (32), ambiente comunitario (23), denominación (19), acogida (17) y ubicación/distancia (16).
- En una ficha de iglesia se priorizan: declaración doctrinal (38), ubicación (27), denominación (24), liderazgo (23) y horarios (22).

## Decisiones de alcance para el MVP

El MVP se concentra en información verificable y búsqueda estructurada. Las percepciones sobre acogida, ambiente y confianza se mostrarán como experiencias moderadas, diferenciadas claramente de datos institucionales. No se usarán para declarar que una iglesia es "mejor" ni para recomendar automáticamente en la primera versión.

## Atributos iniciales

### Iglesia

| Grupo | Atributos | Fuente / validación |
|---|---|---|
| Identificación | nombre oficial, nombre alternativo, descripción breve, estado de verificación | institución o moderación |
| Ubicación | dirección, comuna, latitud, longitud, accesibilidad declarada | OpenStreetMap + institución |
| Información esencial | denominación, rama cristiana, declaración doctrinal, etiquetas doctrinales, idiomas | institución; moderación para etiquetas |
| Reuniones | nombre, día, hora de inicio/fin, público objetivo, modalidad, dirección o enlace | institución |
| Comunidad | grupos/ministerios, rangos etarios, actividades de jóvenes, familias y acción social | institución |
| Liderazgo y contacto | nombre/cargo público, canales oficiales, enlaces web/redes | institución |
| Evidencia visual | fotos, enlaces de video, fuente, fecha de actualización | institución o moderación |
| Calidad | fuente, fecha de actualización, nivel de verificación, reportes | sistema/moderación |

### Usuario

| Grupo | Atributos | Uso |
|---|---|---|
| Cuenta | id, correo, nombre visible opcional, rol | acceso y privacidad |
| Ubicación | coordenada aproximada o comuna, radio máximo | búsqueda y distancia |
| Preferencias | ramas/denominaciones de interés, etiquetas doctrinales, actividades, idioma, rango de distancia | filtros y recomendación basada en contenido |
| Contexto | situación de búsqueda, interés en primera visita, necesidades de contacto previo | personalización de la experiencia |
| Interacciones | vistas, guardados, descartes con motivo opcional, solicitud de contacto, asistencia confirmada | aprendizaje futuro; no exponer públicamente |

### Información aportada por usuarios

| Entidad | Atributos mínimos | Regla |
|---|---|---|
| Reseña/experiencia | iglesia, texto, dimensiones opcionales (acogida, claridad de información), fecha, estado | moderación previa o posterior y opción de reporte |
| Corrección de datos | campo propuesto, valor, evidencia/enlace, estado | nunca reemplaza un dato institucional sin revisión |
| Solicitud de contacto | iglesia, usuario, canal elegido, consentimiento, estado | no revelar teléfono/correo sin consentimiento explícito |

## Requisitos funcionales priorizados

| ID | Prioridad | Requisito | Evidencia de encuesta |
|---|---|---|---|
| RF-01 | Must | Buscar iglesias por ubicación o comuna y radio de distancia. | 27 solicitan ubicación; 16 señalan distancia como dificultad. |
| RF-02 | Must | Filtrar por rama, denominación y etiquetas/doctrina declarada. | Doctrina: 32 dificultades / 38 solicitudes; denominación: 19 / 24. |
| RF-03 | Must | Mostrar ficha con ubicación, horario, declaración doctrinal, denominación, liderazgo y fuente/fecha de datos. | Los seis campos concentran la mayor demanda. |
| RF-04 | Must | Permitir guardar, descartar y comparar iglesias; el descarte puede registrar motivo opcional. | Responde a la necesidad de evaluar alternativas antes de visitar. |
| RF-05 | Should | Mostrar actividades, ministerios y eventos por público objetivo. | Jóvenes: 16; acción social: 12; familias: 10. |
| RF-06 | Should | Mostrar enlaces oficiales, fotos y medios institucionales. | Redes: 10; fotos: 7; comentarios abiertos piden videos. |
| RF-07 | Should | Permitir contacto o solicitud de primera visita solo mediante canales autorizados por la iglesia. | Aparece reiteradamente en respuestas abiertas. |
| RF-08 | Could | Recibir reseñas y experiencias con reporte, moderación y separación de datos verificados. | 11 solicitan experiencias; existe preocupación explícita por confianza. |
| RF-09 | Could | Recomendar inicialmente por coincidencia explícita de preferencias, distancia y completitud/verificación de ficha. | Reduce el problema sin necesitar historial suficiente. |

## Requisitos no funcionales y reglas de diseño

- RNF-01 Privacidad: ubicación aproximada por defecto; consentimiento antes de compartir datos de contacto; minimización de datos personales.
- RNF-02 Trazabilidad: todo dato institucional debe registrar fuente, fecha de actualización y estado de verificación.
- RNF-03 Imparcialidad: la plataforma describe y filtra atributos; no califica doctrinas ni utiliza opiniones sensibles como verdad objetiva.
- RNF-04 Moderación: reseñas, reportes y correcciones deben tener estados `pendiente`, `aprobado`, `rechazado` y motivo/auditoría.
- RNF-05 Accesibilidad y claridad: filtros legibles, lenguaje neutral, aviso explícito cuando un dato es aportado por comunidad o por usuarios.
- RNF-06 Calidad de datos: coordenadas válidas, horarios normalizados, identificación de duplicados y campos esenciales obligatorios para publicar una ficha.

## Criterios iniciales de compatibilidad

Para resolver el *cold start*, la primera recomendación será explicable y no usará filtrado colaborativo:

`puntaje = 0,40 doctrina/denominación + 0,25 distancia + 0,20 actividades + 0,10 idioma/horario + 0,05 calidad de ficha`

Los pesos son hipótesis de diseño derivadas de la encuesta, no resultados estadísticos definitivos. Deben validarse con usuarios antes de convertirse en la matriz de compatibilidad oficial. Las interacciones futuras alimentarán un componente colaborativo solo cuando exista volumen suficiente y con controles de privacidad.

## Pendientes para cerrar la fase 2

1. Validar la taxonomía doctrinal con un representante de las tradiciones incluidas.
2. Definir valores permitidos y descripciones neutras para cada etiqueta.
3. Diseñar la matriz formal de compatibilidad y confirmar pesos mediante prueba con usuarios.
4. Definir políticas de consentimiento, verificación institucional y moderación.
5. Convertir los requisitos Must/Should en historias de usuario y criterios de aceptación para fase 3.
