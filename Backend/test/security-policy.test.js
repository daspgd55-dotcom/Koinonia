const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadConfig}=require('../src/config/env'),{loadSecurityPolicy,defaults}=require('../src/config/security-policy'),{observeDecision}=require('../src/services/security-observation.service'),{createApp}=require('../src/app');
const base={MONGO_URI:'mongodb://127.0.0.1/isolated',JWT_SECRET:'policy-test-only-secret-longer-than-32-characters'};
test('Valores predeterminados mantienen pausa y no requieren servicios futuros',()=>{
 const c=loadConfig(base);assert.equal(c.verificationPaused,true);assert.equal(c.requireVerifiedEmail,true);assert.equal(c.mail,null);assert.deepEqual(c.securityPolicy,defaults);
 for(const legacy of ['true','false'])assert.equal(loadConfig({...base,ENFORCE_LEGACY_EMAIL_VERIFICATION:legacy}).verificationPaused,true);
});
test('Combinaciones independientes de observación, política inmutable y servicio existente',()=>{
 for(const captcha of ['off','observe'])for(const abuse of ['off','observe']){
  const c=loadConfig({...base,CAPTCHA_MODE:captcha,ADVANCED_ABUSE_MODE:abuse});assert.equal(c.securityPolicy.captchaMode,captcha);assert.equal(c.securityPolicy.advancedAbuseMode,abuse);
  createApp(c);createApp(c);assert.equal(Object.isFrozen(c.securityPolicy),true);assert.equal(Reflect.set(c.securityPolicy,'captchaMode','off'),false);assert.equal(Reflect.set(c,'securityPolicy',{}),false);
 }
 const c=loadConfig({...base,EMAIL_VERIFICATION_REQUIRED:'true',RESEND_API_KEY:'mock',MAIL_FROM:'test@example.test',APP_PUBLIC_URL:'https://example.test'});assert.equal(c.verificationPaused,false);assert.equal(c.securityPolicy.adminMfaRequired,false);
});
test('No aparenta activar mecanismos pendientes ni acepta valores ambiguos',()=>{
 for(const [key,value] of Object.entries({ADVANCED_ABUSE_MODE:'enforce'}))assert.throws(()=>loadConfig({...base,[key]:value}),/pendiente/);
 for(const mode of ['off','dry-run','apply'])assert.equal(loadConfig({...base,SECURITY_CLEANUP_MODE:mode}).securityPolicy.cleanupMode,mode);
 for(const key of ['ADMIN_MFA_REQUIRED','CAPTCHA_MODE','MAIL_QUEUE_ENABLED','ADVANCED_ABUSE_MODE','SECURITY_CLEANUP_MODE','EMAIL_VERIFICATION_REQUIRED','ENFORCE_LEGACY_EMAIL_VERIFICATION'])assert.throws(()=>loadConfig({...base,[key]:'unexpected-secret'}),e=>!e.message.includes('unexpected-secret'));
 assert.throws(()=>loadConfig({...base,EMAIL_VERIFICATION_REQUIRED:'true'}),/Configura correo/);
 assert.throws(()=>loadConfig({...base,CAPTCHA_MODE:'enforce'}),/Turnstile/);
 assert.throws(()=>loadConfig({...base,MAIL_QUEUE_ENABLED:'true'}),/cola/);
 assert.throws(()=>createApp({...base,securityPolicy:{adminMfaRequired:true}}),/claves MFA/);
 assert.throws(()=>loadConfig({...base,ADMIN_MFA_REQUIRED:'true'}),/claves MFA/);
 assert.throws(()=>loadConfig({...base,MFA_ENCRYPTION_KEYS:'bad',MFA_ACTIVE_KEY_ID:'test'}),/MFA_ENCRYPTION_KEYS/);
});
test('Observación registra solo la decisión permitida sin bloquear ni exponer datos',()=>{
 const policy=loadSecurityPolicy({CAPTCHA_MODE:'observe',ADVANCED_ABUSE_MODE:'observe'}),entries=[];
 for(const control of ['captchaMode','advancedAbuseMode'])for(const wouldBlock of [true,false])assert.deepEqual(observeDecision(policy,control,{wouldBlock,email:'private',token:'secret',reason:'private'},e=>entries.push(e)),{blocked:false,recorded:true});
 assert.equal(entries.length,4);assert.ok(entries.every(e=>Object.keys(e).sort().join(',')==='control,event,wouldBlock'));
 assert.deepEqual(observeDecision(defaults,'captchaMode',{wouldBlock:true},()=>{throw Error();}),{blocked:false,recorded:false});
 assert.deepEqual(observeDecision(policy,'captchaMode',{wouldBlock:true},()=>{throw Error();}),{blocked:false,recorded:false});
});
