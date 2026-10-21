const defaults=Object.freeze({adminMfaRequired:false,captchaMode:'off',mailQueueEnabled:false,advancedAbuseMode:'observe',cleanupMode:'off'});
function choice(env,key,values,fallback){const value=env[key]===undefined?fallback:env[key];if(!values.includes(value))throw Error(`${key}: valor inválido; usa ${values.join(', ')}`);return value;}
function boolean(env,key){return choice(env,key,['true','false'],'false')==='true';}
function validatePolicy(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(defaults,k)))throw Error('Política de seguridad inválida');
 const p={...defaults,...input};
 for(const k of ['adminMfaRequired','mailQueueEnabled'])if(typeof p[k]!=='boolean')throw Error(`Política inválida: ${k}`);
 for(const k of ['captchaMode','advancedAbuseMode'])if(!['off','observe','enforce'].includes(p[k]))throw Error(`Política inválida: ${k}`);
 if(!['off','dry-run','apply'].includes(p.cleanupMode))throw Error('Política inválida: cleanupMode');
 // These mechanisms have not been implemented yet. Never advertise enforcement without them.
 for(const [requested,name] of [[p.advancedAbuseMode==='enforce','Controles avanzados de abuso']])if(requested)throw Error(`${name}: implementación pendiente; no puede activarse todavía`);
 return Object.freeze(p);
}
function loadSecurityPolicy(env=process.env){return validatePolicy({
 adminMfaRequired:boolean(env,'ADMIN_MFA_REQUIRED'),
 captchaMode:choice(env,'CAPTCHA_MODE',['off','observe','enforce'],'off'),
 mailQueueEnabled:boolean(env,'MAIL_QUEUE_ENABLED'),
 advancedAbuseMode:choice(env,'ADVANCED_ABUSE_MODE',['off','observe','enforce'],'observe'),
 cleanupMode:choice(env,'SECURITY_CLEANUP_MODE',['off','dry-run','apply'],'off')
});}
module.exports={defaults,boolean,loadSecurityPolicy,validatePolicy};
