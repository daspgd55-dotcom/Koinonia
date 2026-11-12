export const churchSections={intro:'Sobre la comunidad',doctrine:'Identidad, doctrina y prácticas',visit:'Visítanos',meetings:'Reuniones',life:'Vida en comunidad',contact:'Contacto y enlaces'};
export const orderedSections=value=>[...new Set([...(Array.isArray(value)?value:[]),...Object.keys(churchSections)])].filter(k=>k in churchSections);
