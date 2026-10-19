import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryTags} from '../src/discoveryTags.js';
const church={community:{activities:['Reuniones de Alabanza','Retiros','Voluntariado','Campamentos','Evangelismo'],ministries:['Jóvenes','Formación bíblica']},meetingTypes:['Culto dominical']};
test('Prioriza coincidencias reales de actividades y ministerios aunque figuren al final de la ficha',()=>{
 const user={preferences:{activities:['Campamentos','Evangelismo','Obras Audiovisuales','Bautismos'],ministries:['Jóvenes','Formación bíblica']}};
 const tags=discoveryTags(church,user);assert.equal(tags.length,4);assert.ok(tags.every(t=>t.matched));assert.deepEqual(new Set(tags.map(t=>t.text)),new Set(['Campamentos','Evangelismo','Jóvenes','Formación bíblica']));
});
test('Sin coincidencias ofrece variedad de datos publicados y no afirma afinidad',()=>{
 const tags=discoveryTags(church,{preferences:{activities:['Bautismos']}});assert.deepEqual(tags.map(t=>t.text),['Reuniones de Alabanza','Jóvenes','Retiros','Formación bíblica']);assert.ok(tags.every(t=>!t.matched));assert.deepEqual(discoveryTags(church,null),tags);
});
test('Respeta campos desactivados, categorías, normalización del ranking y duplicados',()=>{
 const tags=discoveryTags({community:{activities:['jóvenes','Evangelismo'],ministries:['Jóvenes','Campamentos']}},{preferences:{activities:['Campamentos','Evangelismo'],ministries:[' JÓVENES ']},criterionModes:{activities:'disabled'}});
 assert.deepEqual(tags.map(t=>[t.text,t.matched]),[['Jóvenes',true],['Evangelismo',false],['Campamentos',false]]);
 assert.equal(discoveryTags({community:{ministries:['Campamentos']}},{preferences:{activities:['Campamentos']}})[0].matched,false);
});
test('Usa reuniones solo si no hay actividades ni ministerios y omite etiquetas si no hay datos',()=>{
 assert.deepEqual(discoveryTags({meetingTypes:['Culto','Culto']},null),[{text:'Culto',field:'meetings',matched:false}]);assert.deepEqual(discoveryTags({},null),[]);
});
