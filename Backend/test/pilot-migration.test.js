const {test}=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose');
const {match,merge,makePlan,digest}=require('../scripts/migrate-pilot-churches');
const oid=n=>new mongoose.Types.ObjectId(n.toString(16).padStart(24,'0'));
const church=(n,extra={})=>({_id:oid(n),createdBy:oid(100),active:true,identification:{name:'Iglesia Centro'},location:{commune:'Santiago',address:'Calle 123'},...extra});
test('Identifica una ficha sintética por su referencia de origen',()=>{
 const s=church(1,{externalProfile:{placeId:'place-one'}}),t=church(2),f={_id:String(t._id),baseReference:{key:'place-one'}};
 assert.equal(String(match(s,[t],[f]).target._id),String(t._id));
});
test('Nombre sin dirección coincidente y varias coincidencias bloquean',()=>{
 const s=church(1,{location:{commune:'Santiago'}});assert.equal(match(s,[church(2)],[]).review,'name_or_address_only');
 assert.equal(match(church(1),[church(2),church(3)],[]).review,'multiple_name_address_matches');
});
test('Dato del piloto reemplaza relleno y conserva el identificador de destino',()=>{
 const t=church(2,{christianIdentity:{denomination:'Bautista'}}),s=church(1,{christianIdentity:{denomination:'Presbiteriana'}}),f={church:structuredClone(t)};
 const result=merge(s,t,f);assert.equal(String(result.document._id),String(t._id));assert.equal(result.document.christianIdentity.denomination,'Presbiteriana');assert.equal(result.conflicts.length,0);
});
test('Edición posterior en destino produce conflicto y no se sobrescribe',()=>{
 const t=church(2,{christianIdentity:{denomination:'Luterana'}}),s=church(1,{christianIdentity:{denomination:'Presbiteriana'}}),f={church:church(2,{christianIdentity:{denomination:'Bautista'}})};
 const result=merge(s,t,f);assert(result.conflicts.includes('christianIdentity.denomination'));assert.equal(result.document.christianIdentity.denomination,'Luterana');
});
function snapshot(){return {source:{churches:[church(1,{externalProfile:{placeId:'p-one'}})],users:[{_id:oid(100),email:'author@example.invalid',password:'hash'}],church_sources:[],test_fixture_provenance:[],rag_test_documents:[]},target:{churches:[church(2)],users:[],church_sources:[],test_fixture_provenance:[{_id:String(oid(2)),id:String(oid(2)),baseReference:{key:'p-one'},church:church(2),enrichedFields:[],syntheticFields:[],inferredFields:[],fieldProvenance:{}}],rag_test_documents:[]}};}
test('Plan copia autor necesario, preserva IDs de iglesia y remapea membresía',()=>{
 const data=snapshot();data.source.users[0].membershipChurch=oid(1);const p=makePlan(data);
 assert.equal(p.blockers.length,0);assert.equal(p.matched,1);assert.equal(p.requiredUsersToInsert,1);assert.equal(String(p.actions.find(a=>a.collection==='users').document.membershipChurch),String(oid(2)));
});
test('Colisión de correo con otro ID bloquea la aplicación',()=>{
 const data=snapshot();data.target.users.push({_id:oid(101),email:'author@example.invalid'});assert(makePlan(data).blockers.some(b=>b.type==='user_email_or_username_collision'));
});
test('No certifica relleno restante y retira del corpus los campos sustituidos',()=>{
 const data=snapshot(),fixture=data.target.test_fixture_provenance[0];
 data.target.churches[0].christianIdentity={denomination:'Bautista',languages:['Español']};fixture.church=data.target.churches[0];fixture.enrichedFields=['christianIdentity.denomination','christianIdentity.languages'];fixture.syntheticFields=[...fixture.enrichedFields];
 data.source.churches[0].christianIdentity={denomination:'Presbiteriana'};data.source.churches[0].verification={authorized:true};data.source.churches[0].metadata={dataStatus:'verified'};
 const p=makePlan(data),doc=p.actions.find(a=>a.collection==='churches').document,meta=p.actions.find(a=>a.collection==='test_fixture_provenance').document;
 assert.equal(doc.verification.authorized,false);assert.equal(doc.metadata.dataStatus,'published');assert.deepEqual(meta.enrichedFields,['christianIdentity.languages']);
});
test('Huella detecta cambios y conserva tipos BSON',()=>{
 const a=snapshot(),b=snapshot();assert.equal(digest(a),digest(b));b.target.churches[0].active=false;assert.notEqual(digest(a),digest(b));
});
