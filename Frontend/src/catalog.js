// Opciones base transcritas de «Ficha Iglesia - Formularios de Google.pdf», pp. 4–11 y 17–18.
// Las agrupaciones por rama son navegación del cliente, no afirmaciones sobre una iglesia.
export const catalog = {
  // Estilos definidos para Koinonía; solo se publican cuando la comunidad los declara.
  musicalStyles: ["Tradicional / Litúrgica", "Himnodia Clásica", "Góspel", "Música Cristiana Contemporánea (MCC) / Worship", "Géneros Urbanos y Alternativos"],
  culturalStyles: {"Estilo Litúrgico": "Estilo Litúrgico (Tradición, Sacramento e Historia — Vestimenta Formal / Vestiduras Sagradas)", "Estilo Conservador": "Estilo Conservador (Santidad externa y Separación del mundo — Vestimenta Formal y de alta modestia)", "Estilo Moderado": "Estilo Moderado (Decoro, Sencillez y Orden Social — Ropa casual o Semiformal)", "Estilo Contemporáneo": "Estilo Contemporáneo (Gracia, Inclusión y Relevancia Cultural — Vestimenta Libre e Informal)"},
  branches: ['Católica', 'Ortodoxa', 'Protestante', 'Rama Independiente'],
  denominations: ['Católica Romana', 'Bautista', 'Luterana', 'Metodista', 'Presbiteriana', 'Pentecostal', 'Adventista', 'Anglicana', 'Asamblea de Dios', 'Evangélica', 'No Denominacional'],
  denominationsByBranch: {
    Católica: ['Católica Romana'], Ortodoxa: [],
    Protestante: ['Bautista', 'Luterana', 'Metodista', 'Presbiteriana', 'Pentecostal', 'Adventista', 'Anglicana', 'Asamblea de Dios', 'Evangélica', 'No Denominacional'],
    'Rama Independiente': ['Evangélica', 'No Denominacional']
  },
  doctrinalTags: ['Autoridad de las Escrituras', 'Sacramentos / ordenanzas', 'Bautismo infantil', 'Bautismo de creyentes', 'Santa Cena', 'Eucaristía', 'Predicación', 'Culto litúrgico', 'Culto contemporáneo', 'Prácticas carismáticas', 'Evangelización', 'Misiones', 'Formación bíblica'],
  ministries: ['Jóvenes', 'Niños', 'Matrimonios', 'Familias', 'Adultos mayores', 'Música / alabanza', 'Misiones', 'Evangelismo', 'Acción social', 'Ayuda comunitaria', 'Formación bíblica', 'Consejería', 'Deportes', 'Streaming', 'Oración'],
  activities: ['Reuniones de Alabanza', 'Campamentos', 'Retiros', 'Evangelismo', 'Voluntariado', 'Ayuda social', 'Cursos / institutos', 'Conferencias', 'Eventos familiares', 'Actividades deportivas', 'Confraternidades', 'Obras Audiovisuales', 'Bautismos'],
  targetGroups: ['Niños', 'Adolescentes', 'Jóvenes', 'Adultos', 'Adultos mayores', 'Familias intergeneracionales'],
  languages: ['Español', 'Inglés'],
  communes: ['Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba', 'Independencia', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa', 'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquín', 'San Miguel', 'San Ramón', 'Santiago', 'Vitacura', 'Colina', 'Peñaflor', 'San Bernardo', 'Lampa', 'Pirque', 'San José de Maipo', 'Padre Hurtado', 'Puente Alto'],
  // Conservados como candidatos para filtros posteriores; no son filtros activos en esta entrega.
  future: {
    soteriology: ['Calvinismo', 'Arminianismo', 'Molinismo', 'Universalismo Cristiano', 'No se afirma en ninguna de las anteriores'],
    eschatology: ['Premilenialismo Histórico', 'Premilenialismo Dispensacionalista', 'Amilenialismo', 'Posmilenialismo', 'Sin postura definida'],
    meetingTypes: ['Culto principal', 'Misa', 'Estudio bíblico', 'Reunión de jóvenes', 'Reunión de oración', 'Escuela dominical', 'Grupo pequeño / célula'],
    modalities: ['Presencial', 'Online', 'Híbrida'],
    memberRanges: ['0-50', '50-100', '100-200', '200-300', '300-500', '500-1000', '1000-2000', '2000-5000']
  }
};
export function denominationOptions(branches = []) {
  if (!branches?.length || branches.some(b => !catalog.branches.includes(b))) return catalog.denominations;
  return [...new Set(branches.flatMap(b => catalog.denominationsByBranch[b]))];
}
