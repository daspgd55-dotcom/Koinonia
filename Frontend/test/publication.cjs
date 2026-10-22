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


  const request=backend('supertest'),Church=backend('./src/models/church.model'),Interaction=backend('./src/models/interaction.model');
  await request(server).post('/api/auth/register').send({email:'discovery@example.test',password:'Discovery-test-123'}).expect(201);
  const u=await User.findOneAndUpdate({email:'discovery@example.test'},{$set:{'onboarding.status':'completed','preferences.denominations':['Bautista'],'criterionModes.denominations':'preferred'}},{returnDocument:'after'});
  const churches=await Church.create(['Bautista','Metodista','Bautista'].map((denomination,i)=>({identification:{name:'Comunidad Descubrimiento '+(i+1),description:'Presentación institucional de prueba.'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},christianIdentity:{denomination},meetingTypes:['Grupo pequeño / célula'],metadata:{dataStatus:'published',testData:true},createdBy:u._id})));



  await User.updateOne({_id:u._id},{$set:{role:'representative'}});
  const c=await Church.create({identification:{name:'Comunidad lista para revisión'},location:{commune:'Santiago',address:'Dirección de prueba',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},christianIdentity:{denomination:'Bautista'},doctrine:{officialStatement:'Declaración institucional de prueba'},leadership:{mainLeader:{name:'Representante',role:'Pastor'}},meetingTypes:['Culto'],verification:{source:'Declaración del representante',authorized:true},representatives:[u._id],createdBy:u._id});
  async function login(email,password){await page.goto(url+'/#/login');await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Iniciar sesión'}).click();await page.getByRole('button',{name:'Mi perfil',exact:true}).waitFor();}
  await login(u.email,'Discovery-test-123');
  await page.getByRole('link',{name:'Administración',exact:true}).click();
  await page.getByRole('button',{name:'Administrar Comunidad lista para revisión',exact:false}).click();
  await page.getByText(/Preparación de la ficha/).click();await page.getByText(/Datos esenciales completos/).waitFor();await page.getByRole('button',{name:'Solicitar publicación y verificación',exact:true}).click();
  await page.getByText('Solicitud de publicación y verificación pendiente de revisión.',{exact:true}).waitFor();
  assert.equal((await Church.findById(c.id)).metadata.dataStatus,'draft');
  await page.getByRole('button',{name:'Mi perfil',exact:true}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await request(server).post('/api/auth/register').send({email:'publishing-admin@example.test',password:'Publishing-test-123'}).expect(201);
  await User.updateOne({email:'publishing-admin@example.test'},{$set:{role:'admin'}});
  await login('publishing-admin@example.test','Publishing-test-123');
  await page.getByRole('link',{name:'Administración',exact:true}).click();
  await page.getByRole('button',{name:'Solicitudes de publicación y verificación: 1',exact:true}).click();
  await page.getByRole('button',{name:'Administrar Comunidad lista para revisión',exact:false}).waitFor();
  await page.screenshot({path:path.join(output,'publication-requests.png'),fullPage:true});
  await page.getByRole('button',{name:'Administrar Comunidad lista para revisión',exact:false}).click();
  if(await page.locator('.admin-control-fold').count()&&!await page.locator('.admin-control-fold').evaluate(el=>el.open))await page.locator('.admin-control-fold>summary').click();
  await page.getByRole('button',{name:'Publicar',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Administración actualizada'}).waitFor();
  const published=await Church.findById(c.id);assert.equal(published.publicationRequest.status,'pending');assert.equal(published.metadata.dataStatus,'published');await page.getByRole('button',{name:'Marcar verificada',exact:true}).click();await page.getByRole('status').filter({hasText:'Administración actualizada'}).waitFor();await page.goto(url+'/#/iglesia/'+c.id);await page.getByText('✓ Iglesia verificada',{exact:true}).waitFor();assert.equal((await Church.findById(c.id)).publicationRequest.status,'resolved');
  assert.deepEqual(errors,[]);console.log('PUBLICATION OK: representante solicita, administrador recibe bandeja filtrada y publica.');
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
