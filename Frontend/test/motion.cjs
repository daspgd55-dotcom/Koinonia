const assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const backend=createRequire(path.resolve(__dirname,'../../Backend/package.json')),{chromium}=backend('playwright');
let vite,browser;
async function main(){
 const {createServer}=await import('vite');vite=await createServer({root:path.resolve(__dirname,'..'),configFile:false,server:{host:'127.0.0.1',port:0}});await vite.listen();const url='http://127.0.0.1:'+vite.httpServer.address().port;
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.motionCalls=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){const animation=original.call(this,frames,options);window.motionCalls.push({id:this.id,frames,animation});return animation;};});
 await page.route('**/motion-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/test/fixtures/motion.jsx"></script></body></html>'}));
 await page.goto(url+'/motion-test');await page.waitForFunction(()=>window.motionCalls.some(c=>c.id==='panel'));assert.equal(await page.evaluate(()=>motionCalls.some(c=>c.id==='church')),false);
 await page.locator('#church').scrollIntoViewIfNeeded();await page.waitForFunction(()=>motionCalls.some(c=>c.id==='church')&&motionCalls.some(c=>c.id==='event'));
 const entrance=await page.evaluate(()=>motionCalls.find(c=>c.id==='event').frames);assert.deepEqual(entrance,[{opacity:0,translate:'0 24px'},{opacity:1,translate:'0 0'}]);
 await page.locator('#event a').focus();assert.equal(await page.evaluate(()=>motionCalls.find(c=>c.id==='event').animation.playState),'finished');
 await page.evaluate(()=>scrollTo(0,0));await page.locator('#church').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>motionCalls.filter(c=>c.id==='church').length),1);
 await page.getByRole('button',{name:'Cargar tarjetas',exact:true}).click();await page.locator('#extra').scrollIntoViewIfNeeded();await page.waitForFunction(()=>motionCalls.some(c=>c.id==='extra'));
 await page.getByRole('button',{name:'Cambiar página',exact:true}).click();await page.waitForFunction(()=>motionCalls.filter(c=>c.id==='panel').length===2);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.getAnimations().length===0);const count=await page.evaluate(()=>motionCalls.length);await page.locator('#visit').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>motionCalls.length),count);assert.equal(await page.locator('#visit').evaluate(el=>getComputedStyle(el).opacity),'1');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // Without IntersectionObserver the content stays available, without hidden preparation styles.
 await page.addInitScript(()=>{window.IntersectionObserver=undefined;});await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();await page.locator('#event').waitFor();assert.equal(await page.locator('#event').evaluate(el=>getComputedStyle(el).opacity),'1');
 assert.deepEqual(errors,[]);console.log('MOTION OK: reveal al entrar, fade-in up, una vez por ruta, contenido dinámico, teclado, movimiento reducido, móvil y fallback.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await vite?.close();});
