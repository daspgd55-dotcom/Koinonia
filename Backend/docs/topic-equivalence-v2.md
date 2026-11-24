# Apoyo temático por conceptos controlados

Cambio exclusivamente experimental. Se conservan requisitos, ranking y vectores. Dos familias revisadas a partir de ajuste: apoyo social (ayuda social/comunitaria, ayudar/apoyar a vecinos, personas o familias necesitadas) y actividad deportiva (actividades deportivas, hacer/practicar deportes). Son afinidades temáticas amplias, no prueba de un programa específico. No se añadieron equivalencias doctrinales, ni siquiera Santa Cena/Eucaristía, ni umbral coseno.

El resto de términos sigue siendo obligatorio para corroborar el interés: ayuda social no prueba asesoría jurídica o gratuidad. Se exige que un solo pasaje contenga los conceptos/términos, evitando juntar palabras de afirmaciones separadas. Se excluye la cabecera institucional; la negación, ciertos marcadores de incertidumbre y temporalidad provocan abstención conservadora. No es análisis lingüístico general: puede bloquear textos válidos o no detectar otras negaciones. Los candidatos sin respaldo quedan exploratorios. Los retenidos por requisitos nunca se promocionan. UI muestra expresión interpretada, concepto y campo/pasaje fuente.

## Comparación

Se conserva baseline original en Backend/scripts/fixtures/topic-evidence-baseline-v1.cjs. Evaluación offline con expanded-vectors-v1.json (45 fragmentos históricos), mismos candidatos para ambos verificadores. No se consultó MongoDB ni Ollama, no se regeneraron embeddings. Se aisla el efecto de corroboración; no mide ranking, actualidad de fichas, latencia pública o utilidad humana. Casos usados del benchmark v1: únicamente split adjustment; no se ejecutaron los ocho finales antiguos.

- new-12, apoyar vecinos necesitados: 0 → 6 candidatas con apoyo.
- new-14, practicar deportes: 0 → 6.
- new-13, actividades deportivas: 5 → 6; Deportes se reconoce como tema equivalente.
- Ayuda social y voluntariado conservan sus seis candidatas; consultas sin evidencia conservan cero.
- Estas cantidades omiten filtros para aislar la comprobación temática y no equivalen a resultados públicos de consultas mixtas.

## Verificación y reservas

`node Backend/scripts/evaluate-topic-equivalence.cjs`: comparación de ajuste y diez pasajes sintéticos, baseline 6/10, nuevo 9/10, tres mejoras y cero regresiones según expectativas. Persiste el fallo «practicar actividades deportivas»: sobra el verbo practicar tras normalizar; no se corrigió a partir del caso reservado.

Los diez pasajes se ejecutaron inicialmente antes de completar una corrección detectada en ajuste (apoye/apoyar), y se repitieron después; por tanto NO se presentan como holdout intacto. Se creó después una reserva nueva de seis pasajes, sin más cambios en el algoritmo: `node Backend/scripts/evaluate-topic-final.cjs`, baseline 4/6 y nuevo 6/6. Incluye dos equivalencias positivas y cuatro abstenciones (modificador sin evidencia, intención futura, negación, doctrina). Prueba pequeña creada por el desarrollador, no ciega ni independiente. Ambas reservas quedan consumidas.

`node --check Backend/scripts/search-lab-ui/lab.js`: correcto. Invariante de conservación de held comprobada por assert. No hubo recorrido visual, compilación ni prueba remota; reiniciar el laboratorio y recargar UI para aplicar. Evidencia en outputs/search-diagnostics/topic-v2/comparison.json y final-fresh.json. Conserva código ajeno; sin commit, push, despliegue ni envíos.

## Próximos límites

La cobertura permanece deliberadamente acotada: sin equivalencias de enseñanza bíblica, doctrinas, horarios o accesibilidad obligatoria. Un catálogo creciente necesita revisión editorial y evaluación de falsos positivos, no añadir sinónimos indiscriminadamente. Evaluar con nuevas consultas humanas antes de publicar. Los resultados observados no demuestran generalización del lenguaje natural.
