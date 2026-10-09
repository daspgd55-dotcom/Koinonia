# Contrato del recomendador — versión 1

La API Node filtra comunidades activas/publicadas, restricciones explícitas y descartes antes de invocar un servicio privado. Calcula un ranking normalizado y envía solo los mejores resultados solicitados para enriquecer sus explicaciones. Este contrato no implementa todavía la interpretación de lenguaje natural previa a la búsqueda descrita en Hito 2.

## Petición interna

`POST <RECOMMENDER_URL>` con JSON y, si se configuró, `Authorization: Bearer <RECOMMENDER_TOKEN>`.

```json
{
  "version": "1",
  "query": "Actividades para jóvenes",
  "preferences": { "activities": ["Jóvenes"], "radiusKm": 5 },
  "candidates": [{
    "churchId": "000000000000000000000101",
    "score": 0.72,
    "components": { "doctrine": 1, "distance": 0.5, "activities": 0.8, "availability": 0.1, "quality": 0.5 },
    "identification": { "name": "Comunidad de ejemplo" },
    "doctrine": { "officialStatement": "Texto institucional" },
    "community": { "activities": ["Jóvenes"] },
    "sources": [{
      "id": "000000000000000000000201",
      "title": "Programa institucional",
      "url": "https://example.org/programa",
      "text": "Texto aprobado para recuperación."
    }]
  }]
}
```

No se envían correo, contraseña, ID de usuario, roles, representantes ni motivos de descarte. Las preferencias y consulta sí pueden contener información personal introducida por el usuario: el servicio es interno y su conexión a un proveedor externo requiere definir el tratamiento de esos datos. Las fuentes son aprobadas y se limitan a 200 por solicitud; no hay indexación o descarga automática de URLs.

## Respuesta

```json
{
  "engine": "rag",
  "results": [{
    "churchId": "000000000000000000000101",
    "explanation": "La fuente institucional declara actividades para jóvenes.",
    "sourceIds": ["000000000000000000000201"]
  }]
}
```

`engine` puede ser `baseline` o `rag`. El adaptador Python incluido devuelve `baseline`; nunca afirma ejecutar RAG. Para `rag`, cada explicación devuelta debe citar al menos una fuente aprobada de esa comunidad. Si se omite un candidato, conserva su explicación determinista. La API no acepta campos adicionales, comunidades desconocidas, IDs duplicados o fuentes ajenas/inventadas.

Puntajes y orden permanecen bajo control de Node. La API devuelve las referencias en `sourceIds`; el cliente puede consultar las fuentes aprobadas de la comunidad para mostrarlas. Validar los IDs no demuestra que la explicación sea semánticamente fiel: esa evaluación sigue pendiente.

Timeout: 5 segundos. Tamaño máximo de respuesta: 256 KiB. Error de red, timeout, HTTP no exitoso o JSON/esquema inválido: `503 RECOMMENDER_UNAVAILABLE`. IDs o evidencia inválidos: `502 INVALID_RECOMMENDATION`. No hay un fallback silencioso cuando se configuró explícitamente un proveedor. Si la búsqueda no produce candidatos, no se invoca el servicio externo.

## Evolución prevista

1. Incorporar ingestión de documentos aprobados, extracción, fragmentos y versiones.
2. Indexar fragmentos con IDs estables y referencias verificables.
3. Implementar interpretación estructurada de consultas antes de filtrar; definir prioridades frente a filtros explícitos.
4. Recuperar evidencia únicamente de candidatos autorizados, tratando documentos como datos y no como instrucciones.
5. Evaluar fidelidad de explicaciones, cumplimiento de restricciones, latencia, coste y utilidad con usuarios.

No hay filtrado colaborativo implementado. Las selecciones guardadas pueden servir como señales futuras, pero la colección actual representa estado vigente y no historial de eventos.

## Extensión de perfil e incorporación

La API pública acepta `criterionModes` y reutiliza preferencias guardadas, según [el contrato de encuesta](onboarding-profile.md). Solo los criterios `required` filtran; `preferred` puntúa y `disabled` se omite. Modos ausentes mantienen la semántica legada. Los estados de respuesta, contexto personal y progreso no se envían al adaptador. El servicio externo conserva versión 1 y su función de explicación, sin controlar filtros ni ranking. Los campos nuevos de preferencias (`ministries`, `targetGroups`, `meetingDays`) caben en el diccionario de preferencias ya admitido por el adaptador.

## Separación de interfaces

`POST /api/recommendations` admite `mode: "traditional"` opcional. Cuando se envía, calcula candidatos/ranking y devuelve modo `deterministic` sin invocar el proveedor externo, incluso si está configurado. Sin `mode`, se conserva el contrato anterior de enriquecimiento. No acepta modo semantic: ese motor no está implementado.

`GET /api/recommendations/capabilities`, público, devuelve `{traditional:true,semantic:false,semanticStatus:"not_implemented"}`. La pestaña semántica del frontend es una interfaz preparada y explícitamente pendiente de integración. No interpreta ni transmite consultas al LLM.
