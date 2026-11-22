// Etiquetas fijadas antes de generar consultas. Evalúan solo evidencia del corpus, no verdad externa.
module.exports=[
 {id:'volunteers',text:'Quiero participar como voluntario en una comunidad cristiana.',field:'community.activities',tag:'Voluntariado'},
 {id:'camp',text:'Busco una congregación que organice campamentos.',field:'community.activities',tag:'Campamentos'},
 {id:'counsel',text:'Me interesa un ministerio dedicado a la consejería.',field:'community.ministries',tag:'Consejería'},
 {id:'family',text:'Quisiera participar en eventos para familias.',field:'community.activities',tag:'Eventos familiares'},
 {id:'music',text:'Busco un ministerio de música y alabanza.',field:'community.ministries',tag:'Música / alabanza'},
 {id:'older',text:'Quiero conocer un ministerio para adultos mayores.',field:'community.ministries',tag:'Adultos mayores'},
 {id:'retreat',text:'Me gustaría asistir a retiros organizados por una iglesia.',field:'community.activities',tag:'Retiros'},
 {id:'audiovisual',text:'Me interesan comunidades que realicen obras audiovisuales.',field:'community.activities',tag:'Obras Audiovisuales'},
 {id:'medical',text:'Me interesa una iglesia que brinde atención gratuita de neurología.',noEvidence:'Ningún fragmento declara atención neurológica.'},
 {id:'pool',text:'Busco una iglesia con piscina temperada y clases de natación.',noEvidence:'Deportes no demuestra piscina ni clases de natación.'},
 {id:'midnight',text:'Necesito una iglesia con reuniones a medianoche todos los miércoles.',noEvidence:'Los fragmentos no contienen horarios.'},
 {id:'no_camps',text:'Busco una comunidad que no organice campamentos.',noEvidence:'Ningún fragmento declara explícitamente ausencia de campamentos.'},
 {id:'wheelchair_transport',text:'Me interesa una iglesia con traslado a domicilio en vehículo adaptado para silla de ruedas.',noEvidence:'Ayuda social no prueba transporte adaptado.'},
 {id:'bank',text:'Quiero refinanciar mi préstamo hipotecario con una tasa fija.',noEvidence:'Tema ajeno al corpus.'}
];
