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
  vite = await createServer({ root:path.resolve(__dirname,'..'),configFile:false,server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${server.address().port}`}} });
  await vite.listen(); const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const context = await browser.newContext({viewport:{width:1440,height:1000}}), page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.setDefaultTimeout(12000);






 const request=backend('supertest'),Church=backend('./src/models/church.model'),Event=backend('./src/models/event.model'),Participation=backend('./src/models/event-participation.model'),jwt=backend('jsonwebtoken');await Participation.init();
 const u=await User.create({name:'Representante',email:'rep@event-participation.test',password:'test-only-hash',role:'representative'}),adminToken=jwt.sign({sv:0},'web-test-only-secret-longer-than-32-characters',{subject:u.id,issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'});
 const church=await Church.create({identification:{name:'Iglesia de pruebas'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'published',firstPublishedByAdminAt:new Date()},createdBy:u.id,representatives:[u.id]});
 let event=await Event.create({churchId:church.id,title:'Evento con participación',description:'Descripción de prueba',category:'workshop',startsAt:new Date(Date.now()+30*86400000),effectiveEndsAt:new Date(Date.now()+31*86400000),location:{address:'Calle de prueba',commune:'Santiago'},participation:'registration',registrationInstructions:'Inscríbete con el organizador.',publicationStatus:'published',createdBy:u.id,updatedBy:u.id});
 await request(server).post('/api/auth/register').send({name:'Participante',email:'participant@event.test',password:'Test-only-12345'}).expect(201);
 await page.goto(url+'/#/evento/'+event.id);await page.getByRole('link',{name:'Inicia sesión para indicar tu interés'}).click();await page.getByLabel('Correo electrónico',{exact:true}).fill('participant@event.test');await page.getByLabel('Contraseña',{exact:true}).fill('Test-only-12345');await page.getByRole('button',{name:'Iniciar sesión',exact:false}).click();await page.getByRole('heading',{name:event.title,exact:true}).waitFor();assert.ok(page.url().endsWith('/evento/'+event.id));
 const participation=page.getByRole('region',{name:'Mi participación',exact:true});await participation.getByRole('button',{name:'Me interesa',exact:true}).click();await participation.getByText('Tu elección:',{exact:false}).waitFor();await participation.getByRole('button',{name:'Voy a asistir',exact:true}).click();await participation.locator('button[aria-pressed="true"]',{hasText:'Voy a asistir'}).waitFor();assert.ok((await participation.textContent()).includes('No reemplaza la inscripción oficial'));
 await participation.getByRole('link',{name:'Ver mis eventos'}).click();await page.getByRole('heading',{name:'Mis eventos',exact:true}).waitFor();await page.getByRole('link',{name:event.title,exact:true}).waitFor();
 event=(await request(server).patch('/api/events/'+event.id).set('Authorization','Bearer '+adminToken).set('If-Match','"1"').send({venue:'Nueva sede'}).expect(200)).body.data;
 await page.evaluate(()=>window.dispatchEvent(new Event('visits-changed')));await page.getByRole('button',{name:'Notificaciones, 1 sin leer',exact:true}).click();const notice=page.getByRole('region',{name:'Últimas notificaciones'});await notice.getByRole('link',{name:/Evento con participación/}).click();await page.getByRole('heading',{name:event.title,exact:true}).waitFor();await page.getByRole('button',{name:'Notificaciones',exact:true}).waitFor();
 await page.goto(url+'/#/notificaciones');await page.getByText('Leída',{exact:true}).waitFor();await page.getByRole('link',{name:'Ver evento',exact:true}).click();await participation.getByRole('button',{name:'Retirar mi participación',exact:true}).click();await participation.getByText('Tu elección:',{exact:false}).waitFor({state:'hidden'});await participation.getByRole('button',{name:'Me interesa',exact:true}).click();
 await request(server).patch('/api/events/'+event._id+'/status').set('Authorization','Bearer '+adminToken).set('If-Match','"'+event.version+'"').send({eventStatus:'cancelled',cancellationReason:'Suspendido por lluvia.'}).expect(200);await page.reload();await page.getByText('Evento cancelado',{exact:true}).waitFor();assert.equal(await participation.getByRole('button',{name:'Voy a asistir',exact:true}).count(),0);
 await page.goto(url+'/#/mis-eventos');await page.getByText('No tienes eventos en esta sección.',{exact:true}).waitFor();await page.getByLabel('Mostrar eventos personales').selectOption('history');await page.getByRole('link',{name:event.title,exact:true}).waitFor();await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,'event-participation-mobile.png'),fullPage:true});await page.getByRole('button',{name:'Retirar mi participación',exact:true}).click();await page.getByText('No tienes eventos en esta sección.',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('EVENT PARTICIPATION UI OK: login con regreso, opciones excluyentes, retiro, mis eventos, campana, lectura, cancelación e historial móvil.');
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
