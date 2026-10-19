// Cuentas ficticias exclusivas de la base sintética. Nunca resetea cuentas existentes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseArgs}=require('node:util');
const mongoose=require('mongoose'),bcrypt=require('bcryptjs'),User=require('../src/models/user.model');
const {fields}=require('../src/validation/profile'),{validateCriteria}=require('../src/services/profile.service');
const {DATABASE,configureDns,failureDetails}=require('./import-test-dataset');
const ROOT=path.resolve(__dirname,'../..'),FILE=path.join(ROOT,'Backend/.cache/test-accounts/recommendation-users-v1.json');
const scenarios=[
 {slug:'bautista.santiago',name:'Prueba Bautista Centro',commune:'Santiago',location:{lat:-33.4489,lng:-70.6693},radiusKm:10,denominations:['Bautista'],branches:['Protestante'],ministries:['Formación bíblica','Jóvenes'],activities:['Cursos / institutos'],doctrinalTags:['Autoridad de las Escrituras'],targetGroups:['Jóvenes'],languages:['Español'],meetingDays:['Domingo'],required:['denominations'],summary:'Bautista obligatoria; formación bíblica y jóvenes; comuna y distancia flexibles.'},
 {slug:'catolica.providencia',name:'Prueba Católica Providencia',commune:'Providencia',location:{lat:-33.4310,lng:-70.6090},radiusKm:12,denominations:['Católica Romana'],branches:['Católica'],ministries:['Familias','Acción social'],activities:['Voluntariado','Eventos familiares'],doctrinalTags:['Eucaristía'],targetGroups:['Familias intergeneracionales'],languages:['Español'],meetingDays:['Domingo'],required:['branches'],summary:'Rama Católica obligatoria; familias, Eucaristía y voluntariado preferidos.'},
 {slug:'presbiteriana.nunoa',name:'Prueba Presbiteriana Ñuñoa',commune:'Ñuñoa',location:{lat:-33.4569,lng:-70.5975},radiusKm:15,denominations:['Presbiteriana'],branches:['Protestante'],ministries:['Formación bíblica','Consejería'],activities:['Conferencias','Cursos / institutos'],doctrinalTags:['Predicación','Formación bíblica'],targetGroups:['Adultos'],languages:['Español'],meetingDays:['Domingo','Miércoles'],required:['denominations'],summary:'Presbiteriana obligatoria; predicación, formación y consejería preferidas.'},
 {slug:'pentecostal.maipu',name:'Prueba Pentecostal Maipú',commune:'Maipú',location:{lat:-33.5090,lng:-70.7575},radiusKm:12,denominations:['Pentecostal','Asamblea de Dios'],branches:['Protestante'],ministries:['Música / alabanza','Oración','Jóvenes'],activities:['Reuniones de Alabanza','Campamentos'],doctrinalTags:['Prácticas carismáticas'],targetGroups:['Jóvenes'],languages:['Español'],meetingDays:['Viernes','Domingo'],required:['commune','radiusKm'],summary:'Maipú y radio de 12 km obligatorios; afinidad pentecostal flexible. Caso de restricciones geográficas.'},
 {slug:'adventista.puentealto',name:'Prueba Adventista Puente Alto',commune:'Puente Alto',location:{lat:-33.6095,lng:-70.5758},radiusKm:30,denominations:['Adventista'],branches:['Protestante'],ministries:['Familias','Ayuda comunitaria'],activities:['Ayuda social'],doctrinalTags:['Formación bíblica'],targetGroups:['Familias intergeneracionales'],languages:['Español'],meetingDays:['Sábado'],required:['denominations','meetingDays'],summary:'Adventista y reuniones en sábado obligatorias; cercanía y ayuda comunitaria preferidas.'},
 {slug:'explorador.lascondes',name:'Prueba Explorador Las Condes',commune:'Las Condes',location:{lat:-33.4080,lng:-70.5670},radiusKm:25,ministries:['Acción social','Deportes'],activities:['Voluntariado','Actividades deportivas'],targetGroups:['Jóvenes','Adultos'],languages:['Español'],meetingDays:['Sábado','Domingo'],required:[],summary:'Sin preferencia de rama, denominación ni doctrina; prioriza acción social y deportes.'},
 {slug:'familia.laflorida',name:'Prueba Familia La Florida',commune:'La Florida',location:{lat:-33.5220,lng:-70.5980},radiusKm:18,denominations:['Bautista','Pentecostal','No Denominacional'],branches:['Protestante','Rama Independiente'],ministries:['Niños','Familias','Matrimonios'],activities:['Eventos familiares','Retiros'],targetGroups:['Niños','Familias intergeneracionales'],languages:['Español'],meetingDays:['Domingo'],required:[],summary:'Perfil familiar amplio; todas las coincidencias son preferencias, sin filtros obligatorios.'},
 {slug:'bilingue.recoleta',name:'Prueba Bilingüe Recoleta',commune:'Recoleta',location:{lat:-33.4060,lng:-70.6400},radiusKm:15,ministries:['Misiones','Streaming'],activities:['Obras Audiovisuales','Confraternidades'],targetGroups:['Adultos'],languages:['Inglés'],meetingDays:['Miércoles','Viernes','Domingo'],required:['languages'],summary:'Inglés obligatorio; cualquier rama o denominación; misiones y streaming preferidos.'}
];
function profile(s){
 const preferences=Object.fromEntries(fields.filter(f=>s[f]!==undefined).map(f=>[f,s[f]]));preferences.location=s.location;
 const criterionModes=Object.fromEntries(fields.map(f=>[f,s[f]===undefined?'disabled':s.required.includes(f)?'required':'preferred']));
 const answerStates=Object.fromEntries(fields.map(f=>[f,s[f]===undefined?'no_preference':'answered']));answerStates.location='answered';
 const searchContext={spiritualIdentity:s.slug.startsWith('explorador')?'no_religion':'christian',goal:s.slug.startsWith('explorador')?'explore':'join',firstVisitPreference:'information'};
 for(const field of Object.keys(searchContext))answerStates[field]='answered';
 validateCriteria(preferences,criterionModes);
 return {name:s.name,username:'test_'+s.slug.replaceAll('.','_').slice(0,19),email:s.slug+'@koinonia.test',role:'user',active:true,membershipChurch:null,preferences,criterionModes,answerStates,searchContext,onboarding:{status:'completed',version:3,lastStep:3,completedAt:new Date(),updatedAt:new Date()},profileRevision:1};
}
function credentials(){
 if(fs.existsSync(FILE))return JSON.parse(fs.readFileSync(FILE,'utf8'));
 const accounts=scenarios.map(s=>({slug:s.slug,email:s.slug+'@koinonia.test',password:'KoTest-'+crypto.randomBytes(7).toString('base64url')+'!'}));
 fs.mkdirSync(path.dirname(FILE),{recursive:true});fs.writeFileSync(FILE,JSON.stringify({database:DATABASE,testOnly:true,accounts},null,2)+'\n',{mode:0o600});return {accounts};
}
async function main(){
 const {values:v}=parseArgs({options:{apply:{type:'boolean',default:false},'dns-server':{type:'string'}}});configureDns(v['dns-server']);
 const secret=credentials(),documents=[];
 for(const s of scenarios){
  const account=secret.accounts.find(a=>a.slug===s.slug);if(!account||account.email!==s.slug+'@koinonia.test')throw Error('Manifiesto de cuentas incompatible');
  const _id=crypto.createHash('sha256').update('koinonia-test-users-v1:'+s.slug).digest('hex').slice(0,24);
  const user=new User({_id,...profile(s),password:await bcrypt.hash(account.password,12)});await user.validate();documents.push(user.toObject());
 }
 console.log(JSON.stringify({mode:v.apply?'apply':'local_plan',database:DATABASE,accounts:documents.length,role:'user',credentialsFile:FILE}));if(!v.apply)return;
 await mongoose.connect(process.env.MONGO_URI,{dbName:DATABASE,serverSelectionTimeoutMS:10000,autoIndex:false,autoCreate:false});
 const db=mongoose.connection.db;if(db.databaseName!==DATABASE)throw Error('Destino incorrecto');
 if(!await db.collection('churches').countDocuments({'metadata.testData':true}))throw Error('No se detectó el catálogo de pruebas esperado');
 const existing=await db.collection('users').find({$or:[{_id:{$in:documents.map(d=>d._id)}},{email:{$in:documents.map(d=>d.email)}},{username:{$in:documents.map(d=>d.username)}}]}).toArray();
 for(const d of documents){
  const collisions=existing.filter(u=>String(u._id)===String(d._id)||u.email===d.email||u.username===d.username);
  if(!collisions.length)continue;
  const old=collisions[0],account=secret.accounts.find(a=>a.email===d.email);
  if(collisions.length!==1||String(old._id)!==String(d._id)||old.email!==d.email||old.username!==d.username||old.role!=='user'||!old.active||!await bcrypt.compare(account.password,old.password))throw Error('Conflicto con cuenta existente: '+d.email+'; no se sobrescribió');
 }
 const session=await mongoose.startSession();let inserted=0;
 try{await session.withTransaction(async()=>{
  const result=await db.collection('users').bulkWrite(documents.map(d=>({updateOne:{filter:{_id:d._id},update:{$setOnInsert:d},upsert:true}})),{session});inserted=result.upsertedCount;
 });}finally{await session.endSession();}
 const auth=require('../src/controllers/auth.controller'),recommend=require('../src/controllers/recommendation.controller').recommend,report=[];
 for(const account of secret.accounts){
  let login;await auth.login({body:{email:account.email,password:account.password},app:{locals:{config:{jwtSecret:crypto.randomBytes(32).toString('hex')}}}},{json:r=>{login=r;}});
  if(login.data.role!=='user')throw Error('Rol inesperado');
  const user=await User.findOne({email:account.email});let response;
  await recommend({body:{mode:'traditional',limit:5},user,app:{locals:{config:{}}}},{json:r=>{response=r;}});
  report.push({email:account.email,role:login.data.role,loginVerified:true,results:response.data.length,evaluatedCandidates:response.meta.evaluatedCandidates,topChurch:response.data[0]?.church.identification.name||null});
 }
 const output=path.join(ROOT,'outputs/test-users');fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({database:DATABASE,checkedAt:new Date(),inserted,accounts:report},null,2)+'\n');
 fs.writeFileSync(path.join(output,'profiles.json'),JSON.stringify(scenarios.map(s=>({email:s.slug+'@koinonia.test',summary:s.summary,...profile(s)})),null,2)+'\n');
 console.log(JSON.stringify({status:'ready',database:DATABASE,inserted,verified:report}));
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify(failureDetails(e)));process.exitCode=1;}).finally(()=>mongoose.disconnect());
module.exports={profile,scenarios};
