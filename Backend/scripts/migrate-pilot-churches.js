// Plan por defecto; --apply exige el hash de un plan revisado. Origen siempre de solo lectura.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseArgs}=require('node:util');
const mongoose=require('mongoose'),Church=require('../src/models/church.model'),User=require('../src/models/user.model'),Source=require('../src/models/source.model');
const {configureDns,failureDetails,DATABASE}=require('./import-test-dataset'),{addressKey}=require('../src/services/import-merge.service');
const {documentFor}=require('./build-test-dataset'),{EJSON}=mongoose.mongo.BSON;
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'outputs/pilot-migration'),COLLECTIONS=['churches','users','church_sources','test_fixture_provenance','rag_test_documents'];
let SOURCE='koinonia_pilot';
const id=v=>String(v),clone=v=>EJSON.parse(EJSON.stringify(v,{relaxed:false}));
const blank=v=>v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length);
const plain=v=>v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const equal=(a,b)=>EJSON.stringify(a??null,{relaxed:false})===EJSON.stringify(b??null,{relaxed:false});
const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const get=(obj,p)=>p.split('.').reduce((a,k)=>a?.[k],obj);
function set(obj,p,v){const parts=p.split('.');let node=obj;for(const k of parts.slice(0,-1))node=node[k]??={};node[parts.at(-1)]=clone(v);}
function leaves(obj,p=''){
 if(plain(obj))return Object.entries(obj).flatMap(([k,v])=>leaves(v,p?p+'.'+k:k));
 return blank(obj)?[]:[[p,obj]];
}
function digest(snapshot){
 const stable=v=>Array.isArray(v)?v.map(stable):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 return crypto.createHash('sha256').update(JSON.stringify(stable(EJSON.serialize(snapshot,{relaxed:false})))).digest('hex');
}
function match(source,targets,fixtures){
 const keys=new Set([id(source._id),source.externalProfile?.placeId,...(source.externalProfile?.aliasPlaceIds||[]),...(source.reviewImport?.externalKeys||[]).map(k=>k.replace(/^google_maps:/,''))].filter(Boolean));
 const exact=targets.filter(t=>keys.has(id(t._id))||keys.has(t.externalProfile?.placeId)||(t.externalProfile?.aliasPlaceIds||[]).some(k=>keys.has(k))||keys.has(fixtures.find(f=>id(f._id)===id(t._id))?.baseReference?.key));
 if(exact.length)return exact.length===1?{target:exact[0],method:'id_or_origin'}:{review:'multiple_identity_matches',candidates:exact.map(t=>id(t._id))};
 const addr=addressKey(source),name=fold(source.identification?.name);
 const candidates=targets.filter(t=>addr&&addressKey(t)===addr&&fold(t.identification?.name)===name);
 if(candidates.length)return candidates.length===1?{target:candidates[0],method:'exact_name_and_address'}:{review:'multiple_name_address_matches',candidates:candidates.map(t=>id(t._id))};
 const possible=targets.filter(t=>fold(t.identification?.name)===name||(addr&&addressKey(t)===addr));
 if(possible.length)return {review:'name_or_address_only',candidates:possible.map(t=>id(t._id))};
 return {method:'new_church'};
}
const GROUPS=['identification','location','christianIdentity','doctrine','meetings','meetingTypes','community','leadership','contact','firstVisit','privateFields','media','externalProfile'];
function merge(source,target,fixture){
 if(!target)return {document:clone(source),overridden:leaves(Object.fromEntries(GROUPS.filter(k=>source[k]!==undefined).map(k=>[k,source[k]]))).map(([p])=>p),conflicts:[]};
 const document=clone(target),overridden=[],conflicts=[];
 for(const group of GROUPS)for(const [p,value]of leaves(source[group],group)){
  const current=get(target,p),baseline=get(fixture?.church,p);
  // Una edición del destino posterior a generar la ficha nunca se pisa silenciosamente.
  if(!blank(current)&&!equal(current,value)&&(!fixture||!equal(current,baseline))){conflicts.push(p);continue;}
  if(!equal(current,value)){set(document,p,value);overridden.push(p);}
 }
 return {document,overridden,conflicts};
}
function makePlan(snapshot){
 const {source:s,target:t}=snapshot,blockers=[],actions=[],mapping={},claimed=new Set(),churchChanges=[];
 const proposals=[];
 for(const church of s.churches){
  const found=match(church,t.churches,t.test_fixture_provenance);
  if(found.review){blockers.push({type:found.review,sourceId:id(church._id),name:church.identification?.name,candidates:found.candidates});continue;}
  const targetId=id(found.target?._id||church._id);
  if(claimed.has(targetId)){blockers.push({type:'multiple_source_churches_same_target',sourceId:id(church._id),targetId});continue;}
  claimed.add(targetId);mapping[id(church._id)]=targetId;proposals.push({church,found,targetId});
 }
 for(const {church,found,targetId}of proposals){
  const fixture=t.test_fixture_provenance.find(f=>id(f._id)===targetId),merged=merge(church,found.target,fixture);
  if(merged.conflicts.length)blockers.push({type:'destination_edits_require_review',sourceId:id(church._id),targetId,fields:merged.conflicts});
  const doc=merged.document;doc._id=new mongoose.Types.ObjectId(targetId);
  for(const field of ['createdBy','updatedBy','representatives','publicationRequest','active'])if(church[field]!==undefined)doc[field]=clone(church[field]);
  if(church.mergedInto){if(mapping[id(church.mergedInto)])doc.mergedInto=new mongoose.Types.ObjectId(mapping[id(church.mergedInto)]);else blockers.push({type:'unresolved_mergedInto',sourceId:id(church._id)});}
  const remaining=(fixture?.enrichedFields||[]).filter(p=>!merged.overridden.some(q=>p===q||p.startsWith(q+'.')||q.startsWith(p+'.'))&&!(!blank(get(church,p))&&equal(get(church,p),get(doc,p))));
  churchChanges.push({sourceId:id(church._id),targetId,name:church.identification?.name,method:found.method,fieldsFromPilot:merged.overridden,remainingUnverifiedEnrichedFields:remaining});
  doc.verification=remaining.length?{authorized:false,source:'synthetic_test_unverified'}:clone(church.verification||{authorized:false});
  doc.metadata={...doc.metadata,...church.metadata,testData:true,dataStatus:remaining.length&&church.metadata?.dataStatus==='verified'?'published':church.metadata?.dataStatus||doc.metadata?.dataStatus||'draft',version:(found.target?.metadata?.version||0)+1};
  if(found.target)doc.importInfo=clone(found.target.importInfo||{});
  const provenance=fixture?clone(fixture):{_id:targetId,id:targetId,baseReference:{key:church.externalProfile?.placeId||id(church._id)},batchId:'pilot-migration',testOnly:true,fieldProvenance:{}};
  provenance.church=clone(doc);provenance.enrichedFields=remaining;
  provenance.syntheticFields=(fixture?.syntheticFields||[]).filter(p=>remaining.includes(p));provenance.inferredFields=(fixture?.inferredFields||[]).filter(p=>remaining.includes(p));provenance.containsSynthetic=provenance.syntheticFields.length>0;
  provenance.fieldProvenance||={};
  for(const group of GROUPS)for(const [p,value]of leaves(church[group],group))if(equal(value,get(doc,p)))provenance.fieldProvenance[p]={origin:'pilot_import',verified:false,database:SOURCE,sourceId:id(church._id)};
  provenance.migration={sourceDatabase:SOURCE,sourceId:id(church._id),sourceVerification:church.verification||null};
  actions.push({collection:'churches',document:doc});actions.push({collection:'test_fixture_provenance',document:provenance});
  const oldRag=t.rag_test_documents.find(r=>r.churchId===targetId);
  if(oldRag){const updated=documentFor({...provenance,id:targetId});updated.batchId=oldRag.batchId;actions.push({collection:'rag_test_documents',document:{...updated,_id:oldRag._id}});}
 }
 // Solo se copian usuarios que necesita una iglesia o fuente migrada. Los ya existentes conservan sus credenciales.
 const usersNeeded=new Set(),churchIds=new Set([...t.churches.map(c=>id(c._id)),...Object.values(mapping)]);
 for(const a of actions.filter(a=>a.collection==='churches'))for(const value of [a.document.createdBy,a.document.updatedBy,...(a.document.representatives||[]),a.document.publicationRequest?.requestedBy])if(value)usersNeeded.add(id(value));
 const sources=s.church_sources.filter(d=>mapping[id(d.church)]);
 for(const source of sources)if(source.createdBy)usersNeeded.add(id(source.createdBy));
 for(const userId of usersNeeded){
  const existing=t.users.find(u=>id(u._id)===userId),origin=s.users.find(u=>id(u._id)===userId);
  if(existing){if(origin&&fold(existing.email)!==fold(origin.email))blockers.push({type:'user_id_identity_conflict',userId});continue;}
  if(!origin){blockers.push({type:'missing_referenced_user',userId});continue;}
  if(t.users.some(u=>fold(u.email)===fold(origin.email)||(origin.username&&u.username===origin.username))){blockers.push({type:'user_email_or_username_collision',userId});continue;}
  const document=clone(origin);delete document.passwordReset;
  if(document.membershipChurch){const mapped=mapping[id(document.membershipChurch)];if(mapped)document.membershipChurch=new mongoose.Types.ObjectId(mapped);else if(!churchIds.has(id(document.membershipChurch)))blockers.push({type:'unresolved_user_membership',userId});}
  actions.push({collection:'users',document});
 }
 for(const u of t.users)if(u.membershipChurch&&!churchIds.has(id(u.membershipChurch)))blockers.push({type:'existing_user_membership_requires_review',userId:id(u._id),churchId:id(u.membershipChurch),suggestedChurchId:mapping[id(u.membershipChurch)]||null});
 for(const source of sources){
  const document=clone(source);document.church=new mongoose.Types.ObjectId(mapping[id(source.church)]);
  const old=t.church_sources.find(d=>id(d._id)===id(source._id));
  if(old&&!equal(old,document)){blockers.push({type:'source_document_conflict',sourceId:id(source._id)});continue;}
  if(!old)actions.push({collection:'church_sources',document});
 }
 return {sourceDatabase:SOURCE,targetDatabase:DATABASE,fingerprint:digest(snapshot),sourceChurches:s.churches.length,targetChurches:t.churches.length,matched:proposals.filter(p=>p.found.target).length,inserted:proposals.filter(p=>!p.found.target).length,requiredUsersToInsert:actions.filter(a=>a.collection==='users').length,sourcesToInsert:actions.filter(a=>a.collection==='church_sources').length,churchChanges,mapping,blockers,actions,scope:'churches, referenced users and church_sources; no interactions, events or visits'};
}
async function snapshot(client,session){
 const result={source:{},target:{}};
 for(const [side,database]of [['source',SOURCE],['target',DATABASE]])for(const collection of COLLECTIONS)result[side][collection]=await client.db(database).collection(collection).find({},{session}).sort({_id:1}).toArray();
 return result;
}
async function validate(plan){
 for(const a of plan.actions){const Model={churches:Church,users:User,church_sources:Source}[a.collection];if(Model)await new Model(a.document).validate();}
 // Detectar duplicados de proveedor antes de escribir.
 const profiles=new Map();
 for(const a of plan.actions.filter(a=>a.collection==='churches'))if(a.document.externalProfile){const key=a.document.externalProfile.provider+':'+a.document.externalProfile.placeId;if(profiles.has(key))plan.blockers.push({type:'duplicate_provider_identity',ids:[profiles.get(key),id(a.document._id)]});profiles.set(key,id(a.document._id));}
}
async function main(){
 const {values:v}=parseArgs({options:{apply:{type:'boolean',default:false},'dns-server':{type:'string'},'reviewed-hash':{type:'string'},source:{type:'string'}}});configureDns(v['dns-server']);
 if(!process.env.MONGO_URI)throw Error('Falta MONGO_URI');
 if(v.apply&&!/^[a-f0-9]{64}$/.test(v['reviewed-hash']||''))throw Error('--apply requiere --reviewed-hash del plan revisado');
 const client=new mongoose.mongo.MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
 try{
  const databases=(await client.db('admin').admin().listDatabases({nameOnly:true,authorizedDatabases:true})).databases.map(d=>d.name);
  const candidates=databases.filter(n=>fold(n)===fold(v.source||SOURCE));
  if(v.source){if(!databases.includes(v.source))throw Error('La base indicada en --source no existe o no es accesible');SOURCE=v.source;}
  else if(candidates.length===1)SOURCE=candidates[0];
  else throw Error('No se identificó una única base piloto; usa --source con el nombre exacto');
  if(SOURCE===DATABASE)throw Error('Origen y destino no pueden ser iguales');
  const data=await snapshot(client),plan=makePlan(data);await validate(plan);
  if(!data.source.churches.length)plan.blockers.push({type:'source_has_no_churches',database:SOURCE});
  fs.mkdirSync(OUT,{recursive:true});
  const publicPlan={...plan,actions:plan.actions.map(a=>({collection:a.collection,id:id(a.document._id),...(a.collection==='churches'?{name:a.document.identification.name}:{})}))};
  fs.writeFileSync(path.join(OUT,'plan.json'),JSON.stringify(publicPlan,null,2)+'\n');
  console.log(JSON.stringify({...publicPlan,mapping:undefined,actions:undefined,report:path.join(OUT,'plan.json')}));
  if(!v.apply)return;
  if(plan.fingerprint!==v['reviewed-hash'])throw Error('Las bases cambiaron desde el plan revisado; revisar el nuevo plan');
  if(plan.blockers.length)throw Error('Hay conflictos pendientes; no se escribió ningún documento');
  const backup=path.join(ROOT,'Backend/.cache/migration-backups',Date.now()+'-pilot.ejson');fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,EJSON.stringify(data,{relaxed:false}));
  // El respaldo local conserva tipos BSON y credenciales cifradas; está excluido de Git.
  const db=client.db(DATABASE);
  for(const collection of COLLECTIONS)if(!(await db.listCollections({name:collection}).toArray()).length)await db.createCollection(collection);
  const session=client.startSession();
  try{await session.withTransaction(async()=>{
   if(digest(await snapshot(client,session))!==plan.fingerprint)throw Error('Cambios concurrentes; se canceló la migración');
   for(const collection of ['users','churches','church_sources','test_fixture_provenance','rag_test_documents']){
    const actions=plan.actions.filter(a=>a.collection===collection);if(!actions.length)continue;
    await db.collection(collection).bulkWrite(actions.map(a=>({replaceOne:{filter:{_id:a.document._id},replacement:a.document,upsert:true}})),{session});
   }
  });}finally{await session.endSession();}
  console.log(JSON.stringify({status:'migrated',backup,target:DATABASE,churches:await db.collection('churches').countDocuments(),sourceUnmodified:true}));
 }finally{await client.close();}
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify(failureDetails(e)));process.exitCode=1;});
module.exports={makePlan,match,merge,digest};
