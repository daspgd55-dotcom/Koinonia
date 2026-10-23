const assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs/promises');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../Backend/package.json'));
const { chromium } = backend('playwright');
const { MongoMemoryServer } = backend('mongodb-memory-server');
const { connectDB, disconnectDB } = backend('./src/config/db');
const { createApp } = backend('./src/app');
const User = backend('./src/models/user.model');
let mongo, server, vite, browser;
const output = path.resolve(__dirname, '../.cache/journey');
async function main() {
  await fs.mkdir(output,{recursive:true});
  mongo = await MongoMemoryServer.create({ binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../../Backend/.cache/mongodb')} });
  await connectDB(mongo.getUri('koinonia_web_test'));
  server = createApp({requireVerifiedEmail:false,jwtSecret:'web-test-only-secret-longer-than-32-characters',corsOrigins:[],enableTestUi:false}).listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const { createServer } = await import('vite');
  vite = await createServer({ root:path.resolve(__dirname,'..'),configFile:false,envDir:false,define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${server.address().port}`}} });
  await vite.listen(); const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const context = await browser.newContext({viewport:{width:1440,height:1000}}), page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.setDefaultTimeout(12000);


  const request=backend('supertest'),Church=backend('./src/models/church.model'),Visit=backend('./src/models/visit.model');
  async function account(name,role){await request(server).post('/api/auth/register').send({email:name+'@visit-ui.test',name,password:'Visit-ui-123'}).expect(201);return User.findOneAndUpdate({email:name+'@visit-ui.test'},{$set:{role,'onboarding.status':'completed'}},{returnDocument:'after'});}
  const visitor=await account('Visitante','user'),rep=await account('Representante','representative');
  const church=await Church.create({identification:{name:'Comunidad Visita UI'},location:{commune:'Santiago',address:'Calle de prueba 123',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},createdBy:rep._id,representatives:[rep._id],metadata:{dataStatus:'published'},firstVisit:{requestsEnabled:false},meetings:[{type:'Culto',modality:'Presencial',frequencyNotes:'Todos los domingos. Llegar 10 minutos antes.',schedule:[{day:'Domingo',startTime:'11:00',durationMinutes:90}]}]});await Visit.init();
  await page.goto(url+'/#/iglesia/'+church.id);await page.getByRole('heading',{name:'Comunidad Visita UI',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Quiero visitar esta comunidad'}).count(),0);
  const staffContext=await browser.newContext({viewport:{width:1440,height:1000}}),staff=await staffContext.newPage();staff.on('pageerror',e=>errors.push(e.message));staff.setDefaultTimeout(12000);
  async function login(p,u){await p.goto(url+'/#/login');await p.getByLabel('Correo electrónico',{exact:true}).fill(u.email);await p.getByLabel('Contraseña',{exact:true}).fill('Visit-ui-123');await p.getByRole('button',{name:'Iniciar sesión',exact:false}).click();await p.getByRole('button',{name:'Mi perfil',exact:true}).waitFor();}
  await login(staff,rep);await staff.goto(url+'/#/administracion');await staff.getByRole('button',{name:'Administrar Comunidad Visita UI'}).click();await staff.getByRole('button',{name:'Primera visita',exact:true}).click();await staff.getByRole('checkbox',{name:'Recibir avisos de visitas',exact:true}).check();await staff.getByLabel('Acceso a Visitas',{exact:true}).selectOption('selected');await staff.getByRole('checkbox',{name:'Representante',exact:true}).check();await staff.getByRole('button',{name:'Añadir correo de avisos',exact:true}).click();await staff.getByLabel('Correo de avisos 1',{exact:true}).fill('equipo@example.test');await staff.getByRole('button',{name:'Guardar ficha',exact:true}).click();await staff.getByRole('status').filter({hasText:'Ficha guardada.'}).waitFor();
  assert.equal((await Church.findById(church.id)).firstVisit.requestsEnabled,true);assert.equal((await Church.findById(church.id)).visitSettings.accessMode,'selected');
  await page.reload();await page.getByRole('button',{name:'Quiero visitar esta comunidad'}).click();await page.getByLabel('Elige una reunión',{exact:true}).selectOption({label:'Culto · Domingo, 11:00'});await page.getByLabel('Mensaje opcional',{exact:true}).fill('Voy con mi familia.');await page.getByRole('checkbox',{name:'Quiero una respuesta de la comunidad dentro de la aplicación'}).check();await page.getByText(/Tu próxima visita sería/).waitFor();await page.getByRole('link',{name:'Iniciar sesión para avisar'}).click();await page.getByLabel('Correo electrónico',{exact:true}).fill(visitor.email);await page.getByLabel('Contraseña',{exact:true}).fill('Visit-ui-123');await page.getByRole('button',{name:'Iniciar sesión',exact:false}).click();
  await page.getByRole('button',{name:'Avisar que quiero asistir'}).waitFor();assert.equal(await page.getByLabel('Mensaje opcional',{exact:true}).inputValue(),'Voy con mi familia.');await page.screenshot({path:path.join(output,'visit-request-desktop.png'),fullPage:true});await page.getByRole('button',{name:'Avisar que quiero asistir'}).click();await page.getByRole('status').filter({hasText:'Tu aviso fue enviado'}).waitFor();
  assert.equal(await page.getByText(/UTC−3/).count(),0);
  await page.getByRole('button',{name:/^Notificaciones/}).click();await page.getByRole('region',{name:'Notificaciones pendientes'}).waitFor();await page.keyboard.press('Escape');
  let item=await Visit.findOne({visitor:visitor._id});assert.equal(item.message,'Voy con mi familia.');
  await staff.goto(url+'/#/notificaciones');await staff.getByText('Nuevo aviso de visita.',{exact:true}).waitFor();await staff.getByRole('button',{name:/^Notificaciones/}).click();await staff.getByRole('region',{name:'Notificaciones pendientes'}).getByRole('link').filter({hasText:'Nuevo aviso de visita.'}).click();await staff.getByRole('heading',{name:'Visitas',exact:true}).waitFor();await staff.getByLabel('Respuesta para el visitante (opcional)',{exact:true}).fill('Te esperamos en la entrada.');await staff.getByRole('button',{name:'Confirmar recepción',exact:true}).click();await staff.locator('.status-pill').filter({hasText:'Recepción confirmada'}).waitFor();await staff.screenshot({path:path.join(output,'visit-management-desktop.png'),fullPage:true});
  await page.goto(url+'/#/notificaciones');await page.getByText('Te esperamos en la entrada.',{exact:true}).waitFor();await page.getByRole('link',{name:'Ver avisos de visita',exact:true}).click();await page.getByText('Recepción confirmada',{exact:true}).waitFor();await page.getByRole('button',{name:'Notificaciones',exact:true}).waitFor();
  await Church.updateOne({_id:church.id},{$push:{meetings:{type:'Jóvenes',frequency:'weekly',modality:'Presencial',schedule:[{day:'Sábado',startTime:'18:00'}]}}});
  await page.getByRole('button',{name:'Cambiar reunión',exact:true}).click();await page.getByLabel('Nuevo horario',{exact:true}).selectOption({label:'Jóvenes · Sábado, 18:00'});await page.getByRole('button',{name:'Confirmar cambio',exact:true}).click();await page.getByText('Aviso enviado',{exact:true}).waitFor();
  assert.equal((await Visit.findById(item.id)).message,'Voy con mi familia.');assert.equal((await Visit.findById(item.id)).scheduleHistory.length,1);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'visit-mine-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Cancelar aviso',exact:true}).click();await page.getByText('No tienes visitas previstas',{exact:true}).waitFor();await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByText('Cancelado',{exact:true}).waitFor();
  // Simular el paso del tiempo solo en la base de pruebas: nunca se marca inasistencia.
  await Visit.updateOne({_id:item._id},{$set:{status:'received',active:true,endsAt:new Date(0)},$unset:{cancelledBy:''}});
  await page.goto(url+'/#/notificaciones');await page.getByText(/¿Pudiste visitar esta comunidad/).waitFor();await page.locator('article').filter({hasText:'¿Pudiste visitar esta comunidad'}).getByRole('link',{name:'Ver avisos de visita',exact:true}).click();await page.getByRole('button',{name:'No pude asistir',exact:true}).click();await page.getByText('Puedes elegir otra reunión cuando te acomode.',{exact:true}).waitFor();assert.equal((await Visit.findById(item.id)).attendance,'missed');
  await staff.goto(url+'/#/administracion/visitas/historial');await staff.getByText('Finalizado',{exact:true}).waitFor();assert.equal(await staff.getByText('Puedes elegir otra reunión cuando te acomode.',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log('VISITAS WEB OK: activación, selección sin calendario, login conservando respuestas, envío, notificaciones, recepción, cancelación, historial, seguimiento y privacidad de asistencia.');await staffContext.close();
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
