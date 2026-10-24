export const churchSections={intro:'Sobre la comunidad',visit:'Visítanos',meetings:'Reuniones',doctrine:'Identidad, doctrina y prácticas',life:'Vida de comunidad',contact:'Contacto y enlaces'};
export const orderedSections=value=>[...new Set([...(Array.isArray(value)?value:[]),...Object.keys(churchSections)])].filter(k=>k in churchSections);
