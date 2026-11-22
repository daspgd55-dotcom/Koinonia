// Relevancia fijada antes de ejecutar; se evalúan fragmentos, no autoridad ni verdad institucional.
const id=(church,field)=>church+':'+field+':0';
const alma='6ac9b9225017eda79d91466c',ar='1298af8033c6eb4a402bf5a3',corpus='155555f8b883bb7066754b67',met='e6d7e42e79ea95ae9e831496',historic='28f6ea99cc25a2cd1462203d';
module.exports=[
 {id:'courses',text:'Busco una iglesia que organice cursos y conferencias.',relevant:[id(met,'community.activities'),id(ar,'community.activities')]},
 {id:'sports',text:'Quiero participar en actividades deportivas de una iglesia.',relevant:[id(corpus,'community.activities'),id(corpus,'community.ministries'),id(alma,'community.activities')]},
 {id:'liturgy',text:'Busco una comunidad con culto litúrgico y eucaristía.',relevant:[id(corpus,'doctrine.characteristics')]},
 {id:'streaming',text:'Busco un ministerio de streaming en Ñuñoa.',relevant:[id(ar,'community.ministries')]},
 {id:'homes',text:'Quiero conocer una iglesia que visite hogares de adultos mayores y de niños.',relevant:[id(alma,'community.description')]},
 {id:'practical',text:'Busco prédicas que ayuden a aplicar la fe en la vida cotidiana.',relevant:[id(alma,'identification.distinctiveFeatures')]},
 {id:'baptism',text:'Busco una iglesia que practique el bautismo de creyentes.',relevant:[id(alma,'doctrine.characteristics')]},
 {id:'cross_language',text:'Quiero conocer una iglesia inspirada en el Sagrado Corazón de París que tenga esculturas históricas.',relevant:[id(historic,'identification.description')]},
 {id:'absent_accessibility',text:'Necesito una iglesia con intérprete de lengua de señas y baño accesible.',relevant:[],probe:'No hay evidencia de accesibilidad en estos fragmentos.'},
 {id:'absent_schedule',text:'Busco una iglesia con reunión los martes a las ocho de la noche.',relevant:[],probe:'No hay horarios en la muestra.'},
 {id:'unrelated',text:'Necesito un taller para cambiar las pastillas de freno de mi automóvil.',relevant:[],probe:'Tema ajeno al corpus.'},
 {id:'negation',text:'Busco una iglesia que no realice actividades deportivas.',relevant:[],probe:'Ningún fragmento confirma ausencia de deportes; no mencionarlo no demuestra que no existan.'}
];
