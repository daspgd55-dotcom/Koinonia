# Verificación, experiencias, descartes y calidad

## Verificación y publicación
El representante asignado envía POST /api/churches/:id/publication-request con {verificationRequested:true}, usando If-Match. Incluye publicación y solicitud de insignia. También permite solicitar verificación de una comunidad publicada. La solicitud queda pendiente aunque el admin publique sin verificar; se resuelve al conceder verified mediante PATCH /status. Solo admin puede concederla. El estado verified existente mantiene compatibilidad. Como antes, editar una ficha verificada conserva su publicación pero exige renovar verificación. No se añade una sección pública de procedencia.

GET /api/churches/manage/:id/checklist requiere admin o representante asignado. Devuelve nueve secciones, ítems completos/pendientes/esenciales/opcionales, ready, missing y percent. Usa los mismos requisitos que la publicación. La UI indica expresamente que muestra la versión guardada. Completitud no garantiza verificación; no es necesario llenar todos los opcionales para publicar.

## Experiencias
PATCH /api/experiences/:id: propietario autenticado, {category,title,body,displayName,version}. Requiere pertenencia actual y comunidad pública. Pasa a pending, retira de la vista pública y exige nueva moderación. Conserva el historial de decisiones.
POST /api/experiences/:id/withdraw: propietario, {version}; pasa a withdrawn. No requiere seguir perteneciendo. La moderación no puede republicar un relato retirado. El autor puede reenviarlo, sujeto a pertenencia y revisión.
POST /api/experiences/:id/reports: autenticado, {reason} de 5 a 1000 caracteres. Solo contenido público aprobado; un reporte pendiente por autor/experiencia. No despublica automáticamente. Cinco solicitudes por hora por usuario compartidas con envío/edición.
GET /api/experiences/manage?reported=true: reportes pendientes de comunidades asignadas o todas para admin. No revela identidad ni correo del denunciante. Cada reporte conserva motivo, fecha y resolución interna.
PATCH /api/experiences/:id/moderation admite status resolve y motivo obligatorio, sin alterar publicación, o approved/rejected. La resolución es atómica con control de versión, autor, fecha y motivo en BD. Las listas públicas nunca incluyen reportes, su autor ni decisiones internas.
Mis experiencias continúa disponible si el autor deja la comunidad y conserva relatos, para permitir retirarlos. Editar exige pertenencia. Se conservan borradores de edición en sessionStorage.

## Descartadas
Para ti incluye un historial paginado utilizando GET /api/users/me/interactions?type=discarded. Recuperar elimina exclusivamente la interacción del usuario mediante DELETE /api/interactions/:churchId. La iglesia puede volver a recomendaciones si cumple restricciones; no se guarda automáticamente. Se pueden limpiar descartes de fichas no disponibles.

## Ranking tradicional y evaluación
Se renormalizan los pesos doctrina .40, distancia .25, actividades .20, idioma/horario .10 entre los grupos activados por el usuario. No responder un grupo no penaliza afinidad. Datos institucionales ausentes continúan explícitamente como unknown y no se inventa coincidencia.
Con criterios activos: score = .95 × afinidad + .05 × calidad. Sin criterios: calidad ordena exploración sin presentarla como afinidad personal.
Calidad informativa = .60 × completitud + .25 × verificación + .15 × vigencia. Completitud usa ocho grupos públicos; no incluye cantidad de fotos, popularidad, testimonios, contactos privados ni posturas ocultas. Vigencia: <=180 días 1, <=365 días .5, más antiguo o fecha ausente 0. No se publica una nota de calidad espiritual.
La respuesta incluye evidence.activeCriteria, knownCriteria e informationQuality. El orden respeta primero restricciones y descartes.
Evaluación técnica: test/ranking-quality.test.js compara seis pares etiquetados por criterios explícitos (denominación, actividad, distancia, idioma, horario, datos confirmados). Debe acertar 6/6 y probar omisiones, desconocidos, desactivación de criterios y bajo peso de calidad. Estos casos sintéticos no demuestran satisfacción humana ni validan empíricamente las ponderaciones. Falta evaluación con usuarios reales.

## Comprobación
Backend: npm test. Frontend: npm run test:publication, npm run test:experiences, npm run test:discover, npm run build.
Casos nuevos verifican solicitud conjunta y permisos, checklist, edición con nueva moderación, retiro, reportes concurrentes, privacidad del denunciante, resolución y recuperación de descartes.
Eventos, frecuencia pública de reuniones, comparación, LLM/RAG y cambios del informe quedan fuera de esta entrega.
