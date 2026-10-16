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
  server = createApp({jwtSecret:'web-test-only-secret-longer-than-32-characters',corsOrigins:[],enableTestUi:false}).listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const { createServer } = await import('vite');
  vite = await createServer({ root:path.resolve(__dirname,'..'),configFile:false,server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${server.address().port}`}} });
  await vite.listen(); const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const context = await browser.newContext({viewport:{width:1440,height:1000}}), page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.setDefaultTimeout(12000);





 const request=backend('supertest'),Church=backend('./src/models/church.model'),Community=backend('./src/models/linked-community.model'),Event=backend('./src/models/event.model');
 const u=await User.create({name:'Eventos test',email:'public-events@example.test',password:'test-only-hash',role:'admin'});
 const church=await Church.create({identification:{name:'Iglesia eventos públicos'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'published',firstPublishedByAdminAt:new Date()},createdBy:u.id});
 const community=await Community.create({churchId:church.id,name:'Comunidad organizadora',type:'youth',status:'published',createdBy:u.id,updatedBy:u.id});
 const future=new Date(Date.now()+86400000*30),past=new Date(Date.now()-86400000*30);
 const seed=(title,extra={})=>Event.create({churchId:church.id,title,description:'Descripción pública del encuentro',category:'workshop',startsAt:future,effectiveEndsAt:new Date(+future+3600000),modality:'in_person',location:{address:'Calle de prueba 123',commune:'Santiago'},audience:['Jóvenes'],publicationStatus:'published',createdBy:u.id,updatedBy:u.id,...extra});
 const e=await seed('Taller abierto',{communityId:community.id,participation:'registration',registrationInstructions:'Completa el formulario del organizador.',registrationUrl:'https://example.test/registro',contact:{email:'oculto@example.test',phone:'+56 91234'},privateFields:{email:true}}),cancel=await seed('Encuentro cancelado',{eventStatus:'cancelled',cancellationReason:'Suspendido por lluvia.'}),old=await seed('Evento pasado',{startsAt:past,effectiveEndsAt:new Date(+past+3600000)}),draft=await seed('Evento secreto',{publicationStatus:'draft'}),archive=await seed('Evento archivado',{publicationStatus:'archived'});
 const main=page.locator('.public-events-page');
 await page.goto(url+'/#/eventos');await main.getByText('2 eventos encontrados',{exact:true}).waitFor();assert.equal(await main.getByRole('article').count(),2);await main.getByText('Evento cancelado',{exact:true}).waitFor();
 await main.getByLabel('Comuna',{exact:true}).fill('Santiago');await main.locator('summary').click();await main.getByLabel('Categoría',{exact:true}).selectOption('workshop');await main.getByLabel('Público destinatario',{exact:true}).fill('Jóvenes');await main.getByLabel('Desde',{exact:true}).fill(new Date(+future-86400000).toISOString().slice(0,10));await main.getByLabel('Hasta',{exact:true}).fill(new Date(+future+86400000).toISOString().slice(0,10));await main.getByRole('button',{name:'Buscar eventos',exact:true}).click();await main.getByText('2 eventos encontrados',{exact:true}).waitFor();const filtered=page.url();
 await main.getByRole('link',{name:e.title,exact:true}).focus();await page.keyboard.press('Enter');await main.getByRole('heading',{name:e.title,exact:true}).waitFor();assert.equal(await main.getByText('oculto@example.test',{exact:false}).count(),0);await main.getByText('Inscripción requerida',{exact:true}).waitFor();await main.getByRole('link',{name:'Consultar inscripción oficial ↗'}).waitFor();await main.getByRole('link',{name:church.identification.name,exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'events-public-desktop.png'),fullPage:true});await main.getByRole('link',{name:'← Volver a eventos',exact:true}).click();assert.equal(page.url(),filtered);assert.equal(await main.getByLabel('Comuna',{exact:true}).inputValue(),'Santiago');
 await page.goto(url+'/#/evento/'+cancel.id);await main.getByText('Suspendido por lluvia.',{exact:true}).waitFor();await main.getByText('Entrada libre',{exact:true}).waitFor();
 await page.goto(url+'/#/eventos?view=past');await main.getByRole('link',{name:old.title,exact:true}).waitFor();assert.equal(await main.getByRole('article').count(),1);
 await page.goto(url+'/#/eventos?commune=Inexistente');await main.getByRole('heading',{name:'No hay eventos con estos filtros'}).waitFor();
 for(const id of [draft.id,archive.id,'invalid']){await page.goto(url+'/#/evento/'+id);await main.getByRole('heading',{name:'Evento no disponible'}).waitFor();}
 await page.goto(url+'/#/comunidad/'+community.id);let section=page.getByRole('region',{name:'Próximos eventos',exact:true});await section.waitFor();assert.equal(await section.getByRole('article').count(),1);await section.getByRole('link',{name:e.title,exact:true}).click();await main.getByRole('link',{name:'← Volver a la comunidad'}).click();await section.waitFor();
 await page.goto(url+'/#/iglesia/'+church.id);await section.waitFor();assert.equal(await section.getByRole('article').count(),2);
 await Community.updateOne({_id:community.id},{$set:{status:'draft'}});await page.goto(url+'/#/evento/'+e.id);await main.getByRole('heading',{name:'Evento no disponible'}).waitFor();await Community.updateOne({_id:community.id},{$set:{status:'published'}});
 await Church.updateOne({_id:church.id},{$set:{'metadata.dataStatus':'draft'}});await page.goto(url+'/#/evento/'+cancel.id);await main.getByRole('heading',{name:'Evento no disponible'}).waitFor();assert.equal((await request(server).get('/api/events').expect(200)).body.pagination.total,0);await Church.updateOne({_id:church.id},{$set:{'metadata.dataStatus':'published'}});
 await page.route('**/api/events?*',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Fallo temporal'}})}));await page.goto(url+'/#/eventos');await main.getByRole('alert').waitFor();await page.unroute('**/api/events?*');await main.getByRole('button',{name:'Reintentar',exact:true}).click();await main.getByText('2 eventos encontrados',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/Menú/}).click();await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Eventos',exact:true}).waitFor();await page.screenshot({path:path.join(output,'events-public-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));

 await page.getByRole('button',{name:/Menú/}).click();
 const online=await seed('Taller en línea',{modality:'online',location:null,onlineUrl:'https://example.test/acceso',participation:'invitation',participationConditions:'Solicita invitación al organizador.',cover:{url:'https://example.test/cover.png',source:'Prueba',frame:'square'}});
 await page.route('https://example.test/cover.png',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw2kAAAAASUVORK5CYII=','base64')}));
 await page.goto(url+'/#/evento/'+online.id);await main.getByText('Invitación',{exact:true}).waitFor();await main.getByRole('link',{name:'Acceso en línea ↗'}).waitFor();await main.getByRole('button',{name:'Ampliar foto',exact:true}).click();await page.getByRole('dialog',{name:'Foto ampliada',exact:true}).waitFor();await page.getByRole('button',{name:'Cerrar',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await request(server).post('/api/auth/register').send({name:'Visitante',email:'visitor@events.test',password:'Test-only-12345'}).expect(201);const login=(await request(server).post('/api/auth/login').send({email:'visitor@events.test',password:'Test-only-12345'}).expect(200)).body;
 await page.evaluate(token=>sessionStorage.setItem('koinonia-session',JSON.stringify(token)),login.token);await page.goto(url+'/#/eventos');await page.reload();await page.getByRole('button',{name:'Mi perfil',exact:true}).waitFor();await main.getByRole('link',{name:online.title,exact:true}).waitFor();
 for(let i=0;i<11;i++)await seed('Actividad adicional '+i);
 await page.reload();await main.getByText('14 eventos encontrados',{exact:true}).waitFor();assert.equal(await main.getByRole('article').count(),12);await main.getByRole('button',{name:'Siguiente',exact:true}).click();await main.getByText('Página 2 de 2',{exact:true}).waitFor();assert.equal(await main.getByRole('article').count(),2);
 await page.goto(url+'/#/eventos');await main.getByText('14 eventos encontrados',{exact:true}).waitFor();await page.screenshot({path:path.join(output,'events-public-mobile.png'),fullPage:true});
 await Event.updateMany({churchId:church.id},{$set:{publicationStatus:'archived'}});await page.goto(url+'/#/comunidad/'+community.id);await page.getByRole('heading',{name:community.name,exact:true}).waitFor();await page.getByText('Consultando próximos eventos…',{exact:true}).waitFor({state:'hidden'});assert.equal(await section.count(),0);
 assert.deepEqual(errors,[]);console.log('PUBLIC EVENTS OK: filtros persistentes, enlaces, teclado, móvil, privacidad, cancelación, pasados, secciones y contenido oculto.');
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
