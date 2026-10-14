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
  await page.goto(url+'/#/descubrir');
  await page.getByRole('heading',{name:'Conoce tu próxima comunidad.'}).waitFor();
  await page.getByText('Comunidad 1 de 3',{exact:false}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Guardar',exact:true}).isDisabled(),true);
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Iniciar sesión',exact:true}).click();
  await page.getByLabel('Correo electrónico',{exact:true}).fill(u.email);await page.getByLabel('Contraseña',{exact:true}).fill('Discovery-test-123');await page.getByRole('button',{name:'Iniciar sesión'}).click();
  await page.getByRole('link',{name:'Para ti',exact:true}).click();
  await page.getByRole('heading',{name:'Comunidad Descubrimiento 1',exact:true}).waitFor();
  await page.getByText('Coincide',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'13-discovery-desktop.png'),fullPage:true});
  await page.getByRole('link',{name:'Ver perfil completo'}).click();
  await page.getByRole('heading',{name:'Comunidad Descubrimiento 1',exact:true}).waitFor();
  await page.getByRole('link',{name:'Volver a descubrimiento'}).click();
  await page.getByText('Comunidad 1 de 3',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Comunidad guardada.'}).waitFor();
  assert.equal((await Interaction.findOne({user:u._id,church:churches[0]._id})).type,'saved');
  await page.getByRole('button',{name:'Deshacer última acción'}).click();
  await page.getByRole('status').filter({hasText:'Acción deshecha.'}).waitFor();
  assert.equal(await Interaction.countDocuments({user:u._id,church:churches[0]._id}),0);
  await page.getByRole('button',{name:'Descartar',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Comunidad descartada'}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Comunidad Descubrimiento 3',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'14-discovery-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('link',{name:'Consulta semántica · LLM/RAG',exact:true}).click();
  await page.getByLabel('Describe la comunidad que te gustaría conocer').fill('Busco jóvenes cerca de Santiago');
  await page.getByRole('status').filter({hasText:'pendiente de integración'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Consultar con LLM/RAG'}).isDisabled(),true);
  await page.screenshot({path:path.join(output,'audit-semantic-mobile.png'),fullPage:true});
  await page.getByRole('link',{name:'Recomendación tradicional',exact:true}).click();
  await page.getByRole('link',{name:'Consulta semántica · LLM/RAG',exact:true}).click();
  assert.equal(await page.getByLabel('Describe la comunidad que te gustaría conocer').inputValue(),'Busco jóvenes cerca de Santiago');
  for(const role of ['representative','admin']){await User.updateOne({_id:u._id},{$set:{role}});await page.reload();await page.getByRole('heading',{name:'Tu búsqueda, en tus palabras.'}).waitFor();await page.getByRole('link',{name:'Recomendación tradicional',exact:true}).click();await page.getByRole('heading',{name:'Comunidad Descubrimiento 3',exact:true}).waitFor();await page.getByRole('link',{name:'Consulta semántica · LLM/RAG',exact:true}).click();}
  assert.deepEqual(errors,[]);
  console.log('DISCOVERY OK: visitantes, tres roles, ranking, ficha/regreso, guardado/deshacer/descarte persistente, móvil y estado semántico honesto.');
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
