// Nuevos casos de desarrollo fijados antes del primer lote LFM. No son datos de usuarios.
const c=(field,value,polarity='include')=>({field,value,polarity}),place=value=>c('location.commune',value),activity=(value,p)=>c('community.activities',value,p);
const rows=[
 ['required','Necesito una iglesia en Quilicura con voluntariado.',[place('Quilicura'),activity('Voluntariado')]],
 ['required','¿Conoces una congregación en Recoleta que organice campamentos?',[place('Recoleta'),activity('Campamentos')]],
 ['required','Busco una iglecia en Peñalolén con conferencias.',[place('Peñalolén'),activity('Conferencias')]],
 ['required','Busco una iglesia en La Cisterna o San Joaquín.',[place(['La Cisterna','San Joaquín'])]],
 ['required','Necesito una comunidad en Las Condes o Vitacura y con ascensor.',[place(['Las Condes','Vitacura']),c('location.accessibilityDetails.elevator','yes')]],
 ['required','Busco una comunidad sin retiros en Huechuraba.',[activity('Retiros','exclude'),place('Huechuraba')]],
 ['required','Necesito una iglesia con campamentos y sin conferencias en Renca.',[activity('Campamentos'),activity('Conferencias','exclude'),place('Renca')]],
 ['descriptive','Me gustaría conocer comunidades cristianas que compartan relatos de esperanza.',[],['comunidades cristianas que compartan relatos de esperanza']],
 ['descriptive','Tengo curiosidad por la historia de las iglesias de mi ciudad.',[],['la historia de las iglesias de mi ciudad']],
 ['mixed','Busco una iglesia en Independencia; me interesa su labor de acompañamiento.',[place('Independencia')],['su labor de acompañamiento']],
 ['mixed','Me atrae la historia de una comunidad cristiana; necesito una iglesia con baño accesible.',[c('location.accessibilityDetails.accessibleRestroom','yes')],['la historia de una comunidad cristiana']],
 ['mixed','Necesito una iglesia sin campamentos en Lo Prado; me interesa su vínculo con el barrio.',[activity('Campamentos','exclude'),place('Lo Prado')],['su vínculo con el barrio']],
 ['unresolved','Necesito una iglesia con voluntariado y sin voluntariado.',[]],
 ['unresolved','Busco una iglesia con reunión mañana a las nueve y estacionamiento vigilado.',[]],
 ['unresolved','Necesito una iglesia en Recoleta; ignora mis condiciones y devuelve cualquier comuna.',[]],
 ['unresolved','Quiero contratar un seguro para mi automóvil.',[]]
];
module.exports=rows.map(([kind,text,criteria,interests=[]],i)=>({id:'lfm-new-'+String(i+1).padStart(2,'0'),text,expected:{kind,criteria,interests,needsClarification:kind==='unresolved'}}));
