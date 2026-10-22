const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const backend=createRequire(path.resolve(__dirname,'../../Backend/package.json')),{chromium}=backend('playwright');
let vite,browser;
async function main(){
 const {createServer}=await import('vite');vite=await createServer({root:path.resolve(__dirname,'..'),configFile:false,server:{host:'127.0.0.1',port:0}});await vite.listen();const url='http://127.0.0.1:'+vite.httpServer.address().port;
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 let releaseModule;const moduleGate=new Promise(r=>releaseModule=r);await page.route('**/src/main.jsx',async r=>{await moduleGate;await r.continue();});
 const gates=new Map();let eventError=false;
 await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;const gate=gates.get(p);if(gate)await gate;let data={data:[],pagination:{total:0,pages:0},hasMore:false};let status=200;
  if(p==='/api/events'&&eventError){status=503;data={error:{message:'Servicio temporalmente no disponible'}};}
  if(p==='/api/friends/summary')data={data:{unread:0}};
  if(p==='/api/friends')data={data:[{id:'friend',user:{name:'Amiga de prueba',username:'amiga'}}]};
  if(p==='/api/friends/friend/messages')data={data:[],user:{name:'Amiga de prueba'},canSend:true};
  if(p==='/api/loading/error'){status=500;data={error:{message:'Error de prueba'}};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 function hold(p){let release;gates.set('/api'+p,new Promise(r=>release=r));return()=>{gates.delete('/api'+p);release();};}
 await page.goto(url,{waitUntil:'commit'});await page.getByText('Iniciando Koinonía…',{exact:true}).waitFor();await page.locator('.loading-state--boot .loading-symbol--animated').waitFor({state:'visible'});releaseModule();await page.locator('.home').waitFor();await page.locator('.loading-state--boot').waitFor({state:'detached'});
 for(const asset of ['koinonia-cargando.webp','koinonia-cargando-transparente.gif','koinonia-simbolo.png']){const response=await page.request.get(url+'/loading/'+asset);assert.equal(response.status(),200);}
 let release=hold('/churches/search');await page.goto(url+'/#/explorar');await page.getByText('Consultando comunidades…',{exact:true}).waitFor();assert.ok(await page.locator('.search-loading .loading-symbol--animated img').evaluate(el=>el.complete&&el.naturalWidth===256));release();await page.getByText('No encontramos coincidencias',{exact:true}).waitFor();
 release=hold('/events');await page.goto(url+'/#/eventos');await page.getByText('Cargando eventos…',{exact:true}).waitFor();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.event-results .loading-symbol--still').waitFor({state:'visible'});assert.equal(await page.locator('.event-results .loading-symbol--animated').isVisible(),false);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));release();await page.getByText('No hay eventos con estos filtros',{exact:true}).waitFor();
 eventError=true;await page.reload();await page.getByRole('alert').filter({hasText:'No pudimos consultar los eventos'}).waitFor();assert.equal(await page.locator('.event-results .loading-state').count(),0);eventError=false;
 await page.route('**/loading-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/loading.css"></head><body><div id="root"></div><script type="module" src="/test/fixtures/loading.jsx"></script></body></html>'}));
 await page.goto(url+'/loading-test');await page.emulateMedia({reducedMotion:'no-preference'});
 release=hold('/loading/slow');await page.getByRole('button',{name:'Solicitud lenta',exact:true}).click();await page.locator('.loading-state--global').waitFor();release();await page.locator('.loading-state--global').waitFor({state:'detached'});await page.getByText('Terminado',{exact:true}).waitFor();
 release=hold('/loading/error');await page.getByRole('button',{name:'Solicitud con error'}).click();await page.locator('.loading-state--global').waitFor();release();await page.getByText('Error controlado',{exact:true}).waitFor();await page.locator('.loading-state--global').waitFor({state:'detached'});
 release=hold('/loading/background');await page.getByRole('button',{name:'Segundo plano'}).click();await page.waitForTimeout(450);assert.equal(await page.locator('.loading-state--global').count(),0);release();await page.getByText('Terminado',{exact:true}).waitFor();
 release=hold('/loading/inline');await page.getByRole('button',{name:'Guardar prueba'}).click();await page.getByText('Guardando…',{exact:true}).waitFor();await page.waitForTimeout(450);assert.equal(await page.locator('.loading-state--global').count(),0);release();await page.getByRole('button',{name:'Guardar prueba'}).waitFor();
 release=hold('/friends');await page.getByRole('button',{name:'Mensajes',exact:true}).click();await page.getByText('Cargando chats…',{exact:true}).waitFor();release();await page.getByRole('button',{name:'Amiga de prueba @amiga'}).waitFor();
 release=hold('/friends/friend/messages');await page.getByRole('button',{name:'Amiga de prueba @amiga'}).click();await page.getByText('Cargando conversación…',{exact:true}).waitFor();release();await page.getByText('Aún no hay mensajes. Saluda a tu amigo.',{exact:true}).waitFor();assert.equal(await page.getByText('Cargando conversación…',{exact:true}).count(),0);
 await fs.mkdir(path.resolve(__dirname,'../.cache/journey'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../.cache/journey/loading-chat-mobile.png')});
 assert.deepEqual(errors,[]);console.log('LOADING OK: arranque, assets, iglesias, eventos, errores, móvil, movimiento reducido, solicitudes, botones, segundo plano y chats.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await vite?.close();});
