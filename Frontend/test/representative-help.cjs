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
  const request=backend('supertest'),Church=backend('./src/models/church.model');
  for(const [email,role] of [['help-rep@example.test','representative'],['help-admin@example.test','admin']]){
   await request(server).post('/api/auth/register').send({email,password:'Help-test-password-123'}).expect(201);
   await User.updateOne({email},{$set:{role}});
  }
  const rep=await User.findOne({email:'help-rep@example.test'});
  await Church.create({identification:{name:'Comunidad ayuda'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},representatives:[rep._id],metadata:{dataStatus:'draft'},createdBy:rep._id});
  async function login(email){await page.goto(url+'/#/login');await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.getByLabel('Contraseña',{exact:true}).fill('Help-test-password-123');await page.getByRole('button',{name:'Iniciar sesión →',exact:true}).click();await page.getByRole('link',{name:'Administración',exact:true}).click();await page.getByRole('button',{name:/Administrar Comunidad ayuda/}).click();}
  const help=page.getByRole('complementary',{name:'Ayuda de primera visita'});
  await login('help-admin@example.test');assert.equal(await help.count(),0);
  await page.getByRole('button',{name:'Doctrina',exact:true}).click();assert.equal(await help.count(),0);
  await page.getByRole('button',{name:'Mi perfil',exact:true}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await login('help-rep@example.test');await help.waitFor();
  await page.getByRole('button',{name:'Entendido',exact:true}).click();assert.equal(await help.count(),0);
  await page.clock.install();
  await page.getByRole('button',{name:'Doctrina',exact:true}).click();await help.waitFor();
  await page.getByRole('button',{name:'Mantener visible',exact:true}).click();await page.mouse.move(0,0);await page.clock.fastForward(30000);assert.equal(await help.isVisible(),true);
  await page.screenshot({path:path.join(output,'representative-help-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Reuniones',exact:true}).click();await help.waitFor();await page.mouse.move(0,0);await page.clock.fastForward(26000);assert.equal(await help.count(),0);
  await page.getByRole('button',{name:'Doctrina',exact:true}).click();assert.equal(await help.count(),0);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Validación y multimedia',exact:true}).click();await help.waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'representative-help-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'No mostrar más ayudas',exact:true}).click();
  await page.getByRole('button',{name:'Identidad cristiana',exact:true}).click();assert.equal(await help.count(),0);
  await page.reload();await page.getByRole('button',{name:/Administrar Comunidad ayuda/}).click();assert.equal(await help.count(),0);
  await page.getByRole('button',{name:'Comunidad',exact:true}).click();assert.equal(await help.count(),0);
  assert.deepEqual(errors,[]);console.log('HELP OK: solo representante, cierre, temporizador, mantener visible, persistencia por cuenta, desactivar y móvil.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
