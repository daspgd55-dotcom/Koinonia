// Operación solicitada para una única ficha sintética; sin transporte de correo.
const mongoose=require('mongoose'),path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});
require('node:dns').setServers(['1.1.1.1']);
mongoose.set('autoIndex',false);mongoose.set('autoCreate',false);
const Church=require('../src/models/church.model'),User=require('../src/models/user.model'),Invitation=require('../src/models/church-outreach-invitation.model'),base=require('../src/services/church-outreach.service'),access=require('../src/services/church-outreach-access.service');
async function main(){await mongoose.connect(process.env.MONGO_URI,{dbName:'koinonia_synthetic_test_v2',autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:10000});if(mongoose.connection.name!=='koinonia_synthetic_test_v2')throw Error('Base inesperada');
 const church=await Church.findById('99c9d10a65979c23e9ece9ce');if(church?.identification?.name!=='Comunidad DEMO Sur'||church.mergedInto)throw Error('Destino cambiado');
 const actor=await User.findById(church.createdBy);if(actor?.role!=='admin')throw Error('Actor de la ficha no es administrador');
 const email='ultralitypro@gmail.com',related=await Invitation.find({church:church._id,active:true}).select('recipient lifecycle expiresAt version');
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({church:church.identification.name,recipient:email,related}));return;}
 if(related.length)throw Error('Ya existe un ciclo activo: revisar antes de renovar');
 let row=await base.create({churchId:church.id,recipient:{email},contactSource:{kind:'direct_contact',collectedAt:new Date().toISOString(),evidence:'Asociación de prueba solicitada explícitamente por el operador en el chat el 2026-11-03; no acredita autoridad institucional.'},expiresAt:new Date(Date.now()+7*86400000).toISOString(),note:'Preparación CLI solicitada por el operador, registrada bajo el administrador creador de la ficha sintética. Sin envío ni concesión de permisos.'},actor);
 row=await base.act(row.id,row.version,{action:'review_target',reason:'Ficha sintética exacta y sin equipo, revisada para el acceso de prueba solicitado por el operador.',acknowledgeInactive:true,acknowledgeExistingTeam:true},actor);
 const result=await access.issue(row.id,row.version,actor);console.log(JSON.stringify({url:'https://koinonia-yvr2.onrender.com'+result.path,expiresAt:result.expiresAt,delivery:result.delivery,invitation:row.id}));
}
main().catch(e=>{console.error(JSON.stringify({error:e.name,code:e.code,message:String(e.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g,'[REDACTED]')}));process.exitCode=1;}).finally(()=>mongoose.disconnect());
