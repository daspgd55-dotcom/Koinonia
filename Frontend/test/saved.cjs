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

  const hidden=await Church.create({identification:{name:'Oculta privada'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'draft'},createdBy:u._id});
  await Interaction.create([...churches,hidden].map(c=>({user:u._id,church:c._id,type:'saved'})));
  await page.goto(url+'/#/guardadas');
  await page.getByLabel('Correo electrónico',{exact:true}).fill(u.email);
  await page.getByLabel('Contraseña',{exact:true}).fill('Discovery-test-123');
  await page.getByRole('button',{name:'Iniciar sesión'}).click();
  await page.getByRole('heading',{name:'Iglesias guardadas',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Comunidad no disponible',exact:true}).waitFor();
  assert.equal(await page.getByText('Oculta privada',{exact:true}).count(),0);
  assert.equal(await page.getByRole('checkbox',{name:/Comparar/}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Comparar seleccionadas',exact:true}).count(),0);
  // Una selección antigua no debe reactivar la interfaz ni permitir el acceso por URL.
  await page.evaluate(({id,selected})=>sessionStorage.setItem('koinonia-saved-view-'+id,JSON.stringify({selected})),{id:u.id,selected:churches.slice(0,2).map(c=>c.id)});
  await page.goto(url+'/#/guardadas/comparar');
  await page.waitForURL('**/#/guardadas');
  await page.getByRole('heading',{name:'Iglesias guardadas',exact:true}).waitFor();
  assert.equal(await page.getByRole('table').count(),0);
  assert.equal(await page.getByRole('checkbox',{name:/Comparar/}).count(),0);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByLabel('Buscar en guardadas',{exact:true}).fill('Descubrimiento 1');
  await page.getByRole('link',{name:'Ver ficha completa',exact:true}).click();
  await page.getByRole('heading',{name:'Comunidad Descubrimiento 1',exact:true}).waitFor();
  await page.getByRole('link',{name:'Volver a guardadas',exact:false}).click();
  assert.equal(await page.getByLabel('Buscar en guardadas',{exact:true}).inputValue(),'Descubrimiento 1');
  await page.getByLabel('Buscar en guardadas',{exact:true}).fill('');
  await page.getByRole('button',{name:'Retirar comunidad no disponible',exact:true}).click();
  await page.getByText('Comunidad retirada de tus guardadas.',{exact:true}).waitFor();
  assert.equal(await Interaction.countDocuments({user:u._id,church:hidden._id}),0);
  await page.route('**/api/interactions/'+churches[0].id,r=>r.abort());
  await page.getByRole('button',{name:'Retirar Comunidad Descubrimiento 1',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await Interaction.countDocuments({user:u._id,church:churches[0]._id}),1);
  await page.unroute('**/api/interactions/'+churches[0].id);
  await page.getByRole('button',{name:'Retirar Comunidad Descubrimiento 1',exact:true}).click();
  await page.getByText('Comunidad retirada de tus guardadas.',{exact:true}).waitFor();
  await page.reload();
  await page.getByRole('heading',{name:'Comunidad Descubrimiento 2',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Comunidad Descubrimiento 1',exact:true}).count(),0);
  await page.screenshot({path:path.join(output,'saved-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:path.join(output,'saved-desktop.png'),fullPage:true});
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Inicio',exact:true}).click();
  await page.getByRole('link',{name:'Iglesias guardadas',exact:false}).click();
  await page.getByRole('heading',{name:'Iglesias guardadas',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Mi perfil',exact:true}).click();
  await page.getByRole('link',{name:'Iglesias guardadas',exact:false}).click();
  await page.getByRole('heading',{name:'Iglesias guardadas',exact:true}).waitFor();
  for(const c of churches.slice(1)){await page.getByRole('button',{name:'Retirar '+c.identification.name,exact:true}).click();await page.getByText('Comunidad retirada de tus guardadas.',{exact:true}).waitFor();}
  await page.getByRole('heading',{name:'Aún no tienes iglesias guardadas',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('SAVED OK: login, privacidad, comparación bloqueada por URL y controles ocultos, regreso, filtro, retirada y fallo conservado, persistencia, accesos y móvil.');
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
