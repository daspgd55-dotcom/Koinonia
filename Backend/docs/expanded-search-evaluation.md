# Muestra ampliada y consultas sin evidencia

## Alcance

Se conservan las cinco iglesias/15 fragmentos originales y se añaden 15 iglesias/30 fragmentos: **20 iglesias, 45 fragmentos**. Selección reproducible desde la instantánea local: comunas menos representadas primero y desempate por ID; solo etiquetas de actividades y ministerios para las nuevas fichas. Todos los nuevos registros tienen `testData:true`. No se modificaron fichas, se corrigieron ubicaciones por inferencia ni se importaron datos a MongoDB.

La revisión textual está en `outputs/church-embeddings-local/expanded-review.md`. Los nombres institucionales no certifican su tipo, ubicación ni servicios: por ejemplo el nombre CEDIN Coquimbo aparece asociado a Santiago en la fuente; se preservó como dato de prueba. La selección sigue sesgada al conjunto disponible, con muchos registros de Santiago. No es una muestra representativa de iglesias reales.

## Preparación y evaluación ejecutadas

Desde la raíz:

```powershell
node Backend/scripts/expand-search-sample.cjs
node Backend/scripts/expand-search-sample.cjs --generate
node Backend/scripts/evaluate-expanded-retrieval.cjs
```

Se revisaron los 30 fragmentos nuevos antes de generar vectores. Reutilizados los 15 anteriores y generados 30 nuevos, mismo digest/formato/modelo embeddinggemma, 768 dimensiones. Generación nueva: 2674 ms. El manifiesto revisado y hashes impiden continuar si cambia el contenido previsto. Estos comandos no conectan a MongoDB.

`scripts/fixtures/expanded-retrieval-queries.cjs` contiene 14 consultas nuevas: 8 positivas y 6 sin evidencia. Las etiquetas positivas se fijaron por coincidencia exacta en campos estructurados del texto almacenado; no se derivaron de los puntajes del modelo. Las negativas se revisaron contra los 45 fragmentos. Ausencia de evidencia en estos textos **no prueba ausencia del servicio en una iglesia**.

Resultados: **Hit@1 7/8, Hit@3 8/8**. Consejería recuperó el primer fragmento pertinente en posición 3. Son métricas por fragmento; no estiman precisión del catálogo ni incluyen las consultas sin evidencia.

| Consulta sin evidencia | Mejor coseno |
| --- | ---: |
| Atención neurológica gratuita | 0,368 |
| Piscina temperada y natación | 0,361 |
| Reuniones a medianoche los miércoles | 0,380 |
| Ausencia de campamentos | 0,303 |
| Transporte adaptado a domicilio | 0,320 |
| Refinanciar préstamo hipotecario | 0,086 |

Mejores cosenos positivos: 0,240–0,463; sin evidencia: 0,086–0,380. Hay solapamiento; un corte que rechazase todas las negativas también perdería positivos. **No se implementó ni calibró un umbral de rechazo**. El modelo encuentra vecinos; no verifica disponibilidad ni negaciones. No hubo ajuste del corpus, consultas o puntajes tras observar resultados.

Artefactos locales:

- `expanded-reviewed.json` y `expanded-review.md`: selección y revisión.
- `expanded-vectors-v1.json`: vectores y procedencia.
- `expanded-query-expectations.json`: etiquetas persistidas antes de consultar el modelo.
- `expanded-evaluation-2026-11-18T15-53-26-932Z.json` y `.md`: rankings completos, métricas, hashes y revisión legible.

## Pantalla ampliada

```powershell
node Backend/scripts/serve-search-lab.cjs --public-dns --expanded
```

Se mantiene http://127.0.0.1:4600/ y el acceso exclusivo local. Omitir `--expanded` conserva la muestra original. La pantalla consulta `/status` para mostrar cantidades reales. Cada búsqueda valida visibilidad, privacidad y hash del texto contra las 20 fichas actuales en la copia remota autorizada antes de presentar fragmentos.

Las cabeceras separan cumplimiento de requisitos de pertinencia temática pendiente. No se presenta «la más cercana» como coincidencia confirmada. Los casos desconocidos siguen solicitando aclaración; sin evidencia de un requisito no se acepta el candidato. Los intereses descriptivos pueden mostrar candidatos, expresamente sin confirmación temática. El rechazo automático de intereses sin evidencia permanece pendiente de una evaluación/calibración independiente.

Se comprobó sintaxis del servidor y cliente. No se ejecutó compilación ni despliegue, ni se enviaron correos. No se hizo recorrido visual en navegador. El servidor quedó iniciado con la muestra ampliada para revisión.

Comprobación HTTP completa: `/status` confirmó 20 iglesias/45 fragmentos. «Busco una iglesia con campamentos.» produjo 4 candidatos con requisitos cumplidos y 16 retenidos, sin fragmentos obsoletos, en 1302 ms. Se utilizó Ollama local y lectura de las 20 fichas; no hubo escrituras remotas. Este caso comprueba el flujo, no la precisión general.
