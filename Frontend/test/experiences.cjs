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


  const request=backend('supertest'),Church=backend('./src/models/church.model'),Interaction=backend('./src/models/interaction.model');
  await request(server).post('/api/auth/register').send({email:'discovery@example.test',password:'Discovery-test-123'}).expect(201);
  const u=await User.findOneAndUpdate({email:'discovery@example.test'},{$set:{'onboarding.status':'completed','preferences.denominations':['Bautista'],'criterionModes.denominations':'preferred'}},{returnDocument:'after'});
  const churches=await Church.create(['Bautista','Metodista','Bautista'].map((denomination,i)=>({identification:{name:'Comunidad Descubrimiento '+(i+1),description:'Presentación institucional de prueba.'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},christianIdentity:{denomination},meetingTypes:['Grupo pequeño / célula'],metadata:{dataStatus:'published',testData:true},createdBy:u._id})));


  const id=churches[0].id;
  await page.goto(url+'/#/experiencias/'+id);
  await page.getByText('Aún no hay experiencias publicadas de esta comunidad.',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Iniciar sesión para escribir',exact:true}).click();
  await page.getByLabel('Correo electrónico',{exact:true}).fill(u.email);
  await page.getByLabel('Contraseña',{exact:true}).fill('Discovery-test-123');
  await page.getByRole('button',{name:'Iniciar sesión'}).click();
  await page.getByLabel('Nombre público',{exact:false}).fill('Visitante de prueba');
  await page.getByLabel('Título',{exact:true}).fill('Mi primera visita');
  await page.getByLabel('Tu experiencia',{exact:false}).fill('Participé en una reunión abierta y conversé sobre las actividades para personas nuevas en la comunidad.');
  await page.route('**/api/churches/'+id+'/experiences',route=>route.request().method()==='POST'?route.abort():route.continue());
  await page.getByRole('button',{name:'Enviar a revisión',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.ok((await page.getByLabel('Tu experiencia',{exact:false}).inputValue()).includes('Participé'));
  await page.unroute('**/api/churches/'+id+'/experiences');
  await page.getByRole('button',{name:'Enviar a revisión',exact:true}).click();
  await page.getByRole('region',{name:'Mis experiencias',exact:true}).getByText('Pendiente de revisión',{exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Experiencias publicadas',exact:true}).getByRole('heading',{name:'Mi primera visita',exact:true}).count(),0);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'experiences-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await request(server).post('/api/auth/register').send({email:'moderator@example.test',password:'Moderator-test-123'}).expect(201);
  await User.updateOne({email:'moderator@example.test'},{$set:{role:'admin'}});
  await page.goto(url+'/#/login');
  await page.getByLabel('Correo electrónico',{exact:true}).fill('moderator@example.test');
  await page.getByLabel('Contraseña',{exact:true}).fill('Moderator-test-123');
  await page.getByRole('button',{name:'Iniciar sesión'}).click();
  await page.getByRole('link',{name:'Administración',exact:true}).click();
  await page.getByRole('link',{name:'Experiencias',exact:true}).click();
  await page.getByRole('heading',{name:'Mi primera visita',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Rechazar',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Aprobar',exact:true}).click();
  await page.getByText('Experiencia aprobada.',{exact:true}).waitFor();
  await page.getByLabel('Estado de revisión',{exact:true}).selectOption('approved');
  await page.getByRole('heading',{name:'Mi primera visita',exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:path.join(output,'experiences-moderation-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.goto(url+'/#/experiencias/'+id);
  await page.getByRole('region',{name:'Experiencias publicadas',exact:true}).getByRole('heading',{name:'Mi primera visita',exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Mis experiencias',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('EXPERIENCES OK: visitante, login, envío conservado ante fallo, pendiente privada, moderación admin y publicación pública, móvil.');
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
