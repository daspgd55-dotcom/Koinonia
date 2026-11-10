# Organizaciones de iglesias — propuesta, sin implementación

## Entidades

Organization: nombre oficial, nombres alternativos, nombre normalizado para búsqueda, slug, tipo (asociación, red, denominación, federación), descripción, alcance geográfico, sede opcional, contactos institucionales, sitio web y redes, logo/portada opcionales, estado (draft/published/archived), verificación independiente, fuentes con URL y fecha, autoría, timestamps y versión optimista. No exigir coordenadas ni horarios de culto: no es una Church.

ChurchOrganizationAffiliation: churchId y organizationId, tipo de vínculo (miembro, afiliada, colaboración; la interfaz distingue estas relaciones), estado (proposed/confirmed/rejected/ended), fuente/evidencia, proponente y revisor, fechas y motivo, historial. Índice único para la pareja iglesia-organización en la primera versión; registrar cambios de vínculo e historial sin duplicar afiliaciones activas. Una iglesia puede tener varias afiliaciones; una organización varias iglesias. No guardar listas duplicadas de churchIds en Organization.

## Autocompletado

El campo actual christianIdentity.network permanece como texto legado. Añadir un selector que busque nombres y alias normalizados (mayúsculas y tildes), con espera breve, mínimo de caracteres, paginación, cancelación de respuestas antiguas y cuotas. Mostrar nombre oficial, tipo y país para distinguir homónimos. Soportar teclado, foco, carga, error y sin resultados.

Seleccionar una organización identifica la entidad, pero propone la afiliación: no la confirma, no modifica la denominación, no concede permisos ni publica información. Ofrecer solicitar una organización nueva cuando no exista; evitar crear entidades con cada texto libre. La administración global revisa duplicados, entidad y vínculo. No inferir pertenencia por la palabra Viña, dominio o nombre parecido.

## Migración y presentación

Conservar network y preparar candidatos locales para revisión. No convertir texto legado en vínculos confirmados automáticamente. Una futura ficha de organización muestra datos públicos y una consulta paginada de iglesias activas/publicables con afiliación confirmada; no revela borradores ni iglesias ocultas. Bajas y fusiones mantienen auditoría y requieren resolver vínculos explícitamente, sin migrar autoridad.

La pertenencia no concede administración sobre las iglesias. Los permisos de representantes de organización se diseñarán por separado; en primera versión solo admin global administra la organización y confirma afiliaciones. Consentimiento y fuentes no se sustituyen por una casilla de verificación visual.

## Etapas propuestas

1. Modelos y contratos, permisos e índices; administración global de organizaciones.
2. Búsqueda accesible y propuestas de afiliación desde la iglesia; revisión administrativa.
3. Migración revisada del texto existente; perfil público y listado paginado.
4. Permisos propios de organización y posibles jerarquías solo tras definir su alcance; impedir ciclos si se añaden relaciones padre-hijo.

Referencia de diseño: https://ivch.cl/ se identifica como Asociación Iglesias La Viña Chile y enlaza su directorio. Esto no verifica por sí solo la afiliación de iglesias concretas del catálogo Koinonía.

No se crearon colecciones, rutas, afiliaciones ni datos externos en esta tarea.
