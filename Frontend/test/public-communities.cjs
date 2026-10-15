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




  const request=backend('supertest'),Church=backend('./src/models/church.model'),Community=backend('./src/models/linked-community.model');
  const u=await User.create({name:'Test',email:'public-linked@example.test',password:'test-only-hash',role:'admin'});
  const church=await Church.create({identification:{name:'Iglesia pública de prueba'},location:{commune:'Santiago',address:'Dirección pública',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'verified',firstPublishedByAdminAt:new Date()},createdBy:u.id,privateFields:{accessibilityLevel:true},representatives:[]});
  const empty=await Church.create({identification:{name:'Iglesia sin grupos'},location:{commune:'Santiago',coordinates:{type:'Point',coordinates:[-70.65,-33.45]}},metadata:{dataStatus:'published'},createdBy:u.id});
  const seed=(name,status,extra={})=>Community.create({churchId:church.id,name,type:'youth',status,createdBy:u.id,updatedBy:u.id,...extra});
  const c=await seed('Jóvenes del barrio','published',{description:'Un espacio de encuentro para jóvenes.',audience:['Universitarios'],leaders:[{name:'Responsable informativo',role:'Coordinación'}],contact:{email:'oculto@example.test',phone:'+56 9 1234 5678',website:'https://example.test'},privateFields:{email:true},location:{mode:'church'},media:[{type:'image',url:'https://example.test/photo.png',source:'Propia',title:'Encuentro de jóvenes',frame:'circle',focalX:25,focalY:75}]}),minimal=await seed('Ministerio sencillo','published'),draft=await seed('Borrador privado','draft'),archived=await seed('Archivada privada','archived');
  await page.route('https://example.test/photo.png',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw2kAAAAASUVORK5CYII=','base64')}));
  await page.goto(url+'/#/iglesia/'+church.id);const section=page.getByRole('region',{name:'Comunidades vinculadas',exact:true});await section.waitFor();assert.equal(await section.getByRole('article').count(),2);assert.equal(await section.getByText('Borrador privado').count(),0);assert.equal(await section.getByText('Archivada privada').count(),0);
  const thumb=section.locator('img');assert.equal(await thumb.evaluate(e=>getComputedStyle(e).borderRadius),'50%');
  await section.getByRole('link',{name:c.name,exact:true}).click();const main=page.locator('.public-linked-page');await main.getByRole('heading',{name:c.name,exact:true}).waitFor();await main.getByRole('link',{name:'Comunidad de '+church.identification.name,exact:true}).waitFor();await main.getByText('Responsable informativo',{exact:true}).waitFor();assert.equal(await main.getByText('oculto@example.test',{exact:false}).count(),0);assert.equal(await main.locator('.verification-badge').count(),0);await main.getByText('Dirección pública, Santiago',{exact:true}).waitFor();assert.equal(await main.getByRole('link',{name:/Teléfono oficial/}).getAttribute('href'),'tel:+56912345678');
  await main.getByRole('button',{name:'Ampliar foto',exact:true}).click();await page.getByRole('dialog',{name:'Foto ampliada',exact:true}).waitFor();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.screenshot({path:path.join(output,'linked-public-desktop.png'),fullPage:true});await main.getByRole('link',{name:'← Volver a la iglesia',exact:true}).click();await section.waitFor();
  await page.goto(url+'/#/comunidad/'+c.id);await main.getByRole('heading',{name:c.name,exact:true}).waitFor();await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'linked-public-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(url+'/#/comunidad/'+minimal.id);await main.getByRole('heading',{name:minimal.name,exact:true}).waitFor();for(const name of ['Responsables','Contacto oficial','Ubicación habitual','¿A quién está dirigida?'])assert.equal(await main.getByRole('heading',{name,exact:true}).count(),0);assert.equal(await main.getByRole('region',{name:'Fotos y videos'}).count(),0);
  for(const id of [draft.id,archived.id,'000000000000000000000000','invalid']){await page.goto(url+'/#/comunidad/'+id);await main.getByRole('heading',{name:'Comunidad no disponible',exact:true}).waitFor();assert.equal(await main.getByText('Borrador privado',{exact:true}).count(),0);assert.equal(await main.getByText('Archivada privada',{exact:true}).count(),0);}
  for(const change of [{'metadata.dataStatus':'draft'},{'metadata.dataStatus':'published',active:false}]){await Church.updateOne({_id:church.id},{$set:change});await page.goto(url+'/#/comunidad/'+c.id);await main.getByRole('heading',{name:'Comunidad no disponible',exact:true}).waitFor();assert.equal((await request(server).get('/api/communities?churchId='+church.id).expect(200)).body.pagination.total,0);}
  await Church.updateOne({_id:church.id},{$set:{'metadata.dataStatus':'published',active:true}});
  await page.route('**/api/communities/'+c.id,r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Error temporal de prueba'}})}));await page.reload();await main.getByRole('heading',{name:'No pudimos cargar la comunidad',exact:true}).waitFor();await page.unroute('**/api/communities/'+c.id);await main.getByRole('button',{name:'Reintentar comunidad',exact:true}).click();await main.getByRole('heading',{name:c.name,exact:true}).waitFor();
  await page.goto(url+'/#/iglesia/'+empty.id);await page.getByRole('heading',{name:empty.identification.name,exact:true}).waitFor();await page.getByText('Consultando comunidades vinculadas…',{exact:true}).waitFor({state:'hidden'});assert.equal(await page.getByRole('region',{name:'Comunidades vinculadas',exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log('PUBLIC LINKED OK: navegación pública/directa, privacidad, marcos, zoom, móvil, secciones ausentes, borrador, archivo, iglesia oculta y recuperación de error.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
