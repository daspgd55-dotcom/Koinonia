const assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),backend=createRequire(path.resolve(__dirname,'../../Backend/package.json'));
const {chromium}=backend('playwright'),{MongoMemoryServer}=backend('mongodb-memory-server'),{connectDB,disconnectDB}=backend('./src/config/db'),{createApp}=backend('./src/app'),User=backend('./src/models/user.model'),bcrypt=backend('bcryptjs'),OTP=backend('otpauth');
let mongo,server,vite,browser;
async function main(){
 mongo=await MongoMemoryServer.create({binary:{version:'8.0.12',downloadDir:path.resolve(__dirname,'../../Backend/.cache/mongodb')}});await connectDB(mongo.getUri('mfa_web_isolated'));
 const email='mfa-browser@example.test',password='Test-browser-123';
 await User.create({email,password:await bcrypt.hash(password,12),role:'admin',onboarding:{status:'completed'}});
 server=createApp({verificationPaused:true,jwtSecret:'isolated-mfa-browser-secret-more-than-32-characters',corsOrigins:[],enableTestUi:false,mfa:{activeKeyId:'test',keys:{test:Buffer.alloc(32,9).toString('base64')}}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const {createServer}=await import('vite');vite=await createServer({root:path.resolve(__dirname,'..'),configFile:false,server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${server.address().port}`}}});await vite.listen();const url=`http://127.0.0.1:${vite.httpServer.address().port}`;
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 async function login(){await page.goto(url+'/#/login');await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Iniciar sesión →',exact:true}).click();}
 await login();await page.waitForURL('**/#/descubrir');await page.goto(url+'/#/cuenta');
 await page.getByLabel('Contraseña actual para segundo factor',{exact:true}).fill(password);await page.getByRole('button',{name:'Configurar segundo factor',exact:true}).click();
 const secret=await page.locator('.mfa-secret code').textContent();await page.getByLabel('Código de la aplicación',{exact:true}).fill(new OTP.TOTP({secret:OTP.Secret.fromBase32(secret)}).generate());await page.getByRole('button',{name:'Confirmar segundo factor'}).click();await page.getByRole('heading',{name:'Guarda tus códigos de recuperación'}).waitFor();
 const codes=await page.locator('.mfa-codes code').allTextContents();assert.equal(codes.length,10);assert.equal(await page.locator('.mfa-secret').count(),0);
 assert.equal(await page.evaluate(s=>JSON.stringify(sessionStorage).includes(s)||JSON.stringify(localStorage).includes(s),secret),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Ya los guardé. Volver a iniciar sesión'}).click();await login();await page.getByRole('heading',{name:'Verifica tu acceso'}).waitFor();
 await page.getByLabel('Código de acceso').fill(codes[0]);await page.getByRole('button',{name:'Verificar y entrar'}).click();await page.waitForURL('**/#/descubrir');
 await page.goto(url+'/#/cuenta');await page.getByText('Activado · 9 códigos de recuperación disponibles.').waitFor();assert.equal(await page.locator('.mfa-codes code').count(),0);
 await page.getByLabel('Contraseña actual para segundo factor',{exact:true}).fill(password);await page.getByLabel('Código de aplicación o recuperación').fill(codes[1]);await page.getByRole('button',{name:'Regenerar códigos'}).click();await page.getByRole('heading',{name:'Guarda tus códigos de recuperación'}).waitFor();assert.notDeepEqual(await page.locator('.mfa-codes code').allTextContents(),codes);assert.deepEqual(errors,[]);console.log('MFA WEB OK: configuración, QR, códigos únicos, login separado, regeneración y móvil.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await disconnectDB();if(mongo)await mongo.stop();});
