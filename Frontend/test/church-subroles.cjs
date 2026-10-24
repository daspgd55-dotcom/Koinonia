const assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs/promises');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../Backend/package.json'));
const { chromium } = backend('playwright');
const { MongoMemoryReplSet } = backend('mongodb-memory-server');
const { connectDB, disconnectDB } = backend('./src/config/db');
const { createApp } = backend('./src/app');
const User = backend('./src/models/user.model');
let mongo, server, vite, browser;
const output = path.resolve(__dirname, '../.cache/journey');
async function main() {
  await fs.mkdir(output,{recursive:true});
  mongo = await MongoMemoryReplSet.create({ binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../../Backend/.cache/mongodb')} });
  await connectDB(mongo.getUri('koinonia_web_test'));
  server = createApp({requireVerifiedEmail:false,jwtSecret:'web-test-only-secret-longer-than-32-characters',corsOrigins:[],enableTestUi:false}).listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const { createServer } = await import('vite');
  vite = await createServer({ root:path.resolve(__dirname,'..'),configFile:false,envDir:false,define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${server.address().port}`}} });
  await vite.listen(); const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const context = await browser.newContext({viewport:{width:1440,height:1000}}), page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.setDefaultTimeout(12000);



  const request=backend('supertest'),Church=backend('./src/models/church.model'),users={};
  for(const [name,role]of [['admin','admin'],['owner','representative'],['normal','user']]){await request(server).post('/api/auth/register').send({email:name+'@team-ui.test',password:'Team-ui-test-123',name}).expect(201);users[name]=await User.findOneAndUpdate({email:name+'@team-ui.test'},{$set:{role,'onboarding.status':'completed'}},{returnDocument:'after'});}
  const church=await Church.create({identification:{name:'Iglesia equipo de prueba'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.6,-33.4]}},createdBy:users.admin._id,representatives:[users.owner._id],leadership:{mainLeader:{name:'Líder antiguo sin identificador'}}});
  async function login(name){await page.goto(url+'/#/login');await page.getByLabel('Correo electrónico',{exact:true}).fill(name+'@team-ui.test');await page.getByLabel('Contraseña',{exact:true}).fill('Team-ui-test-123');await page.getByRole('button',{name:'Iniciar sesión'}).click();await page.getByRole('button',{name:'Mi perfil',exact:true}).waitFor();await page.goto(url+'/#/administracion');await page.getByRole('button',{name:'Administrar Iglesia equipo de prueba',exact:false}).click();}
  async function logout(){await page.getByRole('button',{name:'Mi perfil',exact:true}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();}
  await login('owner');await page.getByText('Orden del perfil público',{exact:true}).click();await page.getByRole('button',{name:'Subir Contacto y enlaces',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Subir Contacto y enlaces',exact:true}).isEnabled(),true);await page.reload();await page.getByRole('button',{name:'Administrar Iglesia equipo de prueba',exact:false}).click();await page.getByRole('button',{name:'Gestionar equipo y subroles',exact:true}).click();await page.getByLabel('Correo o nombre de usuario').fill('normal@team-ui.test');await page.getByRole('button',{name:'Buscar usuario',exact:true}).click();await page.getByLabel('Función a asignar').selectOption('editor');assert.equal(await page.getByLabel('Función a asignar').locator('option[value=administrator]').count(),0);await page.getByRole('button',{name:'Asignar a esta iglesia',exact:true}).click();await page.getByLabel('Función de normal',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'team-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await logout();
  await login('normal');await page.getByRole('button',{name:'Comunidades vinculadas',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Gestionar equipo y subroles',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Guardar ficha',exact:true}).count(),0);await page.getByRole('button',{name:'Comunidades vinculadas',exact:true}).click();await page.getByRole('button',{name:'Crear comunidad vinculada',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Ficha de la iglesia',exact:true}).count(),0);await logout();
  await login('admin');await page.getByRole('button',{name:'Gestionar equipo y subroles',exact:true}).click();await page.getByLabel('Función de normal',{exact:true}).selectOption('moderator');await page.waitForFunction(()=>document.querySelector('[aria-label="Función de normal"]')?.value==='moderator');await page.getByRole('button',{name:'Buscar usuario',exact:true}).waitFor({state:'visible'});await page.waitForTimeout(400);assert.equal((await Church.findById(church.id)).representativeRoles.find(r=>String(r.user)===users.normal.id).subrole,'moderator');
  assert.deepEqual(errors,[]);console.log('Equipo: asignación, editor sin ficha, administrador, móvil y ausencia de errores React OK');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await vite?.close();await new Promise(r=>server?server.close(r):r());await disconnectDB();await mongo?.stop();});
