// Corpus sintético: no representa iglesias ni personas reales. Expectativas fijadas antes de ejecutar.
const documents=[
 {id:'youth',title:'Encuentro juvenil',text:'Comunidad con ministerio de adolescentes y jóvenes. Los sábados hay encuentros de amistad, conversación y acompañamiento para estudiantes.'},
 {id:'service',title:'Servicio al barrio',text:'La iglesia organiza voluntariado, entrega de alimentos y ayuda social a familias del sector. Recibe personas que desean servir a sus vecinos.'},
 {id:'children',title:'Infancia y familias',text:'Durante el culto dominical hay escuela bíblica infantil para niños, con actividades adaptadas a su edad y monitores.'},
 {id:'accessible',title:'Acceso al edificio',text:'La entrada dispone de rampa y acceso sin escalones. El recinto cuenta con baño accesible para personas que utilizan silla de ruedas.'},
 {id:'study',title:'Formación bíblica',text:'Reuniones para estudiar las Escrituras y comprender el contexto de los libros de la Biblia. Cursos semanales abiertos a principiantes.'},
 {id:'music',title:'Ministerio musical',text:'Ensayos del coro y del equipo de alabanza. Invitamos a quienes cantan o tocan instrumentos a participar en la música del culto.'},
 {id:'elderly',title:'Encuentro de personas mayores',text:'Grupo de adultos mayores con reuniones de compañía, conversación y actividades recreativas para personas jubiladas.'},
 {id:'online',title:'Participación a distancia',text:'Los cultos se transmiten por internet. Hay reuniones virtuales para quienes desean participar desde casa.'},
 {id:'welcome',title:'Primera visita',text:'Un equipo de bienvenida recibe a quienes asisten por primera vez, explica cómo funciona la reunión y ayuda a encontrar un lugar.'},
 {id:'stairs',title:'Ingreso al salón',text:'El salón de reuniones está en un segundo piso. Solo se puede ingresar por escaleras; no hay ascensor ni acceso para silla de ruedas.'},
 {id:'no_youth',title:'Actividades disponibles',text:'Actualmente no tenemos ministerio juvenil ni reuniones para adolescentes. Solo se realizan reuniones generales de adultos.'},
 {id:'no_children',title:'Participación infantil',text:'Los niños permanecen con sus familias durante el culto. Actualmente no hay escuela bíblica infantil ni actividades separadas para ellos.'}
];
const queries=[
 {id:'q_youth',text:'Quiero que mi hijo adolescente conozca gente de su edad.',relevant:['youth']},
 {id:'q_service',text:'Me gustaría ayudar a personas necesitadas de mi barrio.',relevant:['service']},
 {id:'q_children',text:'Busco enseñanza cristiana para mis hijos pequeños mientras asisto al culto.',relevant:['children']},
 {id:'q_access',text:'Uso silla de ruedas y necesito entrar sin subir escaleras.',relevant:['accessible']},
 {id:'q_study',text:'Quiero aprender a entender la Biblia desde lo básico.',relevant:['study']},
 {id:'q_music',text:'Toco guitarra y me gustaría acompañar los cantos de la congregación.',relevant:['music']},
 {id:'q_elderly',text:'Mi madre jubilada busca compañía y actividades con otras personas mayores.',relevant:['elderly']},
 {id:'q_online',text:'No puedo salir de casa, pero quiero seguir las reuniones por internet.',relevant:['online']},
 {id:'q_welcome',text:'Nunca he ido y necesito que alguien me oriente al llegar.',relevant:['welcome']},
 {id:'q_service_paraphrase',text:'Busco dónde colaborar repartiendo comida a familias que lo necesitan.',relevant:['service']},
 {id:'probe_absent',text:'Necesito una iglesia con clases de lengua de señas chilena.',relevant:[],probe:true},
 {id:'probe_negative',text:'Busco una comunidad sin actividades juveniles.',relevant:['no_youth'],probe:true},
 {id:'probe_unrelated',text:'Quiero reparar el motor de mi automóvil.',relevant:[],probe:true}
];
module.exports={documents,queries};
