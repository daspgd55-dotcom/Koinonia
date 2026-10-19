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





 const request=backend('supertest'),Church=backend('./src/models/church.model'),Event=backend('./src/models/event.model'),jwt=backend('jsonwebtoken');
 const users={},tokens={};for(const [name,role]of [['admin','admin'],['owner','representative'],['guest','representative'],['peer','representative'],['visitor','user']]){users[name]=await User.create({email:name+'@collab.test',password:'test-only-hash',name,role});tokens[name]=jwt.sign({sv:0},'web-test-only-secret-longer-than-32-characters',{subject:users[name].id,issuer:'koinonia',audience:'koinonia-api',expiresIn:'1h'});}
 const seed=(name,reps)=>Church.create({identification:{name},location:{commune:'Santiago',address:'Calle de prueba',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'published',firstPublishedByAdminAt:new Date()},createdBy:users.admin.id,representatives:reps.map(r=>users[r].id)}),owner=await seed('Iglesia organizadora',['owner']),guest=await seed('Iglesia colaboradora',['guest','peer']);
 const e=await Event.create({churchId:owner.id,title:'Encuentro conjunto',description:'Actividad para iglesias',startsAt:new Date(Date.now()+30*86400000),effectiveEndsAt:new Date(Date.now()+31*86400000),location:{address:'Plaza pública',commune:'Santiago'},publicationStatus:'published',createdBy:users.owner.id,updatedBy:users.owner.id});
 async function login(who,route='/colaboraciones'){await page.goto(url);await page.evaluate(t=>sessionStorage.setItem('koinonia-session',JSON.stringify(t)),tokens[who]);await page.goto(url+'/#'+route);await page.reload();await page.getByRole('button',{name:'Mi perfil',exact:true}).waitFor();}
 page.on('dialog',d=>d.accept());
 await login('owner','/administracion');await page.getByRole('button',{name:'Administrar '+owner.identification.name,exact:false}).click();await page.getByRole('button',{name:'Eventos',exact:true}).click();await page.getByRole('button',{name:'Administrar '+e.title,exact:true}).click();await page.getByText('Participación y contacto',{exact:true}).click();await page.getByLabel('Invitación abierta a otras iglesias',{exact:true}).check();await page.getByRole('button',{name:'Guardar evento',exact:true}).click();await page.getByText('Evento guardado.',{exact:true}).waitFor();
 const panel=page.getByRole('region',{name:'Colaboración entre iglesias',exact:true});await panel.getByLabel('Buscar iglesia publicada',{exact:true}).fill('colaboradora');await panel.getByRole('button',{name:'Buscar iglesias para invitar',exact:true}).click();await panel.getByLabel('Iglesia invitada',{exact:true}).selectOption(guest.id);await panel.getByRole('button',{name:'Enviar invitación',exact:true}).click();await panel.getByText('Pendiente',{exact:true}).waitFor();
 await login('guest');await page.getByRole('button',{name:'Notificaciones, 1 sin leer',exact:true}).click();await page.getByRole('region',{name:'Últimas notificaciones'}).getByRole('link',{name:/Encuentro conjunto/}).click();await page.waitForURL(u=>u.hash.startsWith('#/colaboraciones?eventId='));await page.getByRole('button',{name:'Aceptar invitación',exact:true}).click();await page.getByText('Aceptada',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Aceptar invitación',exact:true}).count(),0);
 await login('peer');await page.getByText('Aceptada',{exact:true}).waitFor();await page.getByRole('button',{name:'Notificaciones',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Aceptar invitación',exact:true}).count(),0);
 await login('visitor','/evento/'+e.id);await page.getByRole('heading',{name:'Iglesias colaboradoras',exact:true}).waitFor();await page.getByRole('heading',{name:'Invitación abierta a otras iglesias',exact:true}).waitFor();await page.getByRole('link',{name:guest.identification.name,exact:true}).click();const upcoming=page.getByRole('region',{name:'Próximos eventos',exact:true});await upcoming.getByRole('link',{name:e.title,exact:true}).waitFor();await upcoming.getByText('Esta iglesia colabora',{exact:true}).waitFor();await upcoming.getByText(owner.identification.name,{exact:true}).waitFor();await page.goto(url+'/#/colaboraciones');await page.getByRole('heading',{name:'Acceso restringido',exact:true}).waitFor();
 await login('guest');await page.getByRole('button',{name:'Retirar aceptación',exact:true}).click();await page.getByText('Retirada',{exact:true}).waitFor();
 await login('owner','/colaboraciones?direction=sent');await page.getByRole('button',{name:'Volver a invitar',exact:true}).click();await page.getByText('Pendiente',{exact:true}).waitFor();
 await login('guest');await page.getByRole('button',{name:'Rechazar invitación',exact:true}).click();await page.getByText('Rechazada',{exact:true}).waitFor();
 await login('admin','/colaboraciones?direction=sent');await page.getByRole('button',{name:'Volver a invitar',exact:true}).click();await page.getByText('Pendiente',{exact:true}).waitFor();await page.getByRole('link',{name:'Recibidas',exact:true}).click();await page.getByRole('button',{name:'Aceptar invitación',exact:true}).click();await page.getByText('Aceptada',{exact:true}).waitFor();await page.getByText('Historial',{exact:true}).click();await page.getByText(/Aceptación · admin \(administrador\)/).waitFor();await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,'collaborations-mobile.png'),fullPage:true});
 await login('owner','/colaboraciones?direction=sent');await page.getByRole('button',{name:'Retirar invitación o colaboración',exact:true}).click();await page.getByText('Retirada',{exact:true}).waitFor();await page.goto(url+'/#/evento/'+e.id);await page.getByRole('heading',{name:e.title,exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Iglesias colaboradoras',exact:true}).count(),0);assert.deepEqual(errors,[]);
 console.log('COLLABORATIONS UI OK: envío, aceptación, lectura compartida, rechazo, retiradas, admin, usuario normal, organizador original, invitación abierta y móvil.');
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
