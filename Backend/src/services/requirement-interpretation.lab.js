// Gramática local conservadora. No ejecuta instrucciones ni delega autoridad a un LLM.
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const communes=['Cerrillos','Cerro Navia','Conchalí','El Bosque','Estación Central','Huechuraba','Independencia','La Cisterna','La Florida','La Granja','La Pintana','La Reina','Las Condes','Lo Barnechea','Lo Espejo','Lo Prado','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda','Peñalolén','Providencia','Pudahuel','Quilicura','Quinta Normal','Recoleta','Renca','San Joaquín','San Miguel','San Ramón','Santiago','Vitacura','Colina','Peñaflor','San Bernardo','Lampa','Pirque','San José de Maipo','Padre Hurtado','Puente Alto'];
const vocabulary=[];
function add(field,value,aliases=[value]){for(const alias of aliases)vocabulary.push({phrase:normalize(alias),field,value});}
for(const value of ['Conferencias','Campamentos','Retiros','Voluntariado','Ayuda social','Eventos familiares','Actividades deportivas','Bautismos','Confraternidades','Obras Audiovisuales','Reuniones de Alabanza'])add('community.activities',value);
add('community.activities','Cursos / institutos',['cursos','institutos','cursos / institutos']);
for(const value of ['Culto litúrgico','Eucaristía','Bautismo de creyentes','Bautismo infantil','Santa Cena','Sola Scriptura','Santa Trinidad','Diezmo','Dones espirituales','Autoridad de las Escrituras','Separación de Iglesia y Estado','Culto contemporáneo','Prácticas carismáticas'])add('doctrine.characteristics',value);
for(const value of ['Streaming','Jóvenes','Niños','Matrimonios','Familias','Adultos mayores','Música / alabanza','Misiones','Evangelismo','Acción social','Ayuda comunitaria','Formación bíblica','Consejería','Deportes','Oración'])add('community.ministries',value,['ministerio de '+value]);
for(const value of communes)add('location.commune',value,['en '+value,'en la comuna de '+value]);
for(const [key,aliases] of Object.entries({ramp:['rampa'],accessibleRestroom:['baño accesible'],elevator:['ascensor'],signLanguage:['intérprete de lengua de señas','apoyo en lengua de señas']}))add('location.accessibilityDetails.'+key,'yes',aliases);
vocabulary.sort((a,b)=>b.phrase.length-a.phrase.length);
function interpret(query){
 if(typeof query!=='string'||!query.trim()||query.length>1000)throw Error('INVALID_QUERY');
 const fail=()=>({criteria:[],unresolved:[query]});
 let text=normalize(query).replace(/[.!?]+$/,'').trim();
 // No se interpreta una disyunción, preferencia o doble negación como condición AND.
 if(/\b(?:pero|aunque|excepto|preferiria|preferiblemente|quizas|no solo|no quiero|no busco|no necesito)\b/.test(text))return fail();
 const start=text.match(/^(?:busco|necesito|quiero(?: encontrar| conocer)?) (?:una |una comunidad |una iglesia )/);
 if(/^quiero participar en .+ de una iglesia$/.test(text))text=text.slice('quiero participar en '.length,-' de una iglesia'.length);
 else if(start){text=text.slice(start[0].length);text=text.replace(/^(?:iglesia|comunidad)\s+/,'');}
 else if(/^(?:busco|necesito|quiero) un ministerio de /.test(text))text=text.replace(/^(?:busco|necesito|quiero) un /,'');
 else return fail();
 let polarity='include',criteria=[];
 while(text){
  const modifier=text.match(/^(con|sin|que (?:no )?(?:tenga|realice|ofrezca|organice|practique))\s+/);
  if(modifier){polarity=modifier[1]==='sin'||modifier[1].startsWith('que no ')?'exclude':'include';text=text.slice(modifier[0].length).replace(/^(?:el|la|los|las)\s+/,'');}
  const term=vocabulary.find(v=>text===v.phrase||text.startsWith(v.phrase+' ')||text.startsWith(v.phrase+','));
  if(!term)return fail();
  // Un complemento de ubicación tiene su propia polaridad; no hereda «sin deportes».
  const effective=term.field==='location.commune'?(modifier&&polarity==='exclude'?'exclude':'include'):polarity;
  text=text.slice(term.phrase.length).trim();let value=term.value;
  if(term.field==='location.commune'&&text.startsWith('o ')){
   if(effective!=='include')return fail();const alternatives=[term.value];
   while(text.startsWith('o ')){text=text.slice(2).replace(/^(?:en la comuna de|en)\s+/,'');const next=[...communes].sort((a,b)=>b.length-a.length).find(c=>text===normalize(c)||text.startsWith(normalize(c)+' ')||text.startsWith(normalize(c)+','));if(!next)return fail();if(!alternatives.includes(next))alternatives.push(next);if(alternatives.length>6)return fail();text=text.slice(normalize(next).length).trim();}
   value=alternatives.length>1?alternatives:alternatives[0];
  }
  const entry={field:term.field,value,polarity:effective},prior=criteria.find(c=>c.field===entry.field&&JSON.stringify(c.value)===JSON.stringify(entry.value));
  if(prior&&prior.polarity!==entry.polarity)return fail();if(!prior)criteria.push(entry);if(criteria.length>12)return fail();
  if(!text)break;
  if(text.startsWith('en ')){polarity='include';continue;}
  // Los modificadores inician otro requisito aunque no haya una conjunción.
  if(/^(?:con|sin|que (?:no )?(?:tenga|realice|ofrezca|organice|practique))\s+/.test(text))continue;
  const connector=text.match(/^(?:,\s*(?:y\s+)?|y\s+)/);if(!connector)return fail();text=text.slice(connector[0].length);if(!text)return fail();
 }
 return criteria.length?{criteria,unresolved:[]}:fail();
}
module.exports={interpret,catalog:()=>Object.fromEntries([...new Set(vocabulary.map(v=>v.field))].map(field=>[field,[...new Set(vocabulary.filter(v=>v.field===field).map(v=>v.value))]]))};
