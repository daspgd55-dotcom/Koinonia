// Genera archivos locales con datos ficticios. No carga configuración ni conecta servicios.
const fs=require('node:fs'),path=require('node:path');
const {render}=require('../src/services/church-outreach-mail-templates');
const output=path.resolve(__dirname,'../../outputs/correos-invitaciones');
const stages={initial:'Invitación inicial',renewal:'Renovación de enlace',clarification:'Solicitud de aclaración','institutional-reminder':'Recordatorio al contacto',member:'Invitación al representante','member-reminder':'Recordatorio al representante',activated:'Confirmación de acceso',received:'Propuesta recibida',approved:'Propuesta revisada',rejected:'Propuesta rechazada'};
const church={identification:{name:'Iglesia de ejemplo'},location:{commune:'Providencia',city:'Santiago'}};
fs.mkdirSync(output,{recursive:true});
for(const stage of Object.keys(stages)) {
 const link=stage==='activated'?'https://example.test/#/login?iglesia=000000000000000000000000':'https://example.test/invitacion-de-muestra';
 const result=render({stage,church,role:'administrator',source:'institutional_website',clarification:'Por favor, confirma quién asumirá la función de representante administrador y revisa su correo antes de volver a enviar la propuesta.',link});
 fs.writeFileSync(path.join(output,stage+'.html'),result.html,'utf8');
 fs.writeFileSync(path.join(output,stage+'.txt'),result.subject+'\n\n'+result.text,'utf8');
}
for(const role of ['editor','moderator','welcome']) {
 const result=render({stage:'member',church,role,link:'https://example.test/invitacion-de-muestra'});
 fs.writeFileSync(path.join(output,'member-'+role+'.html'),result.html,'utf8');
 stages['member-'+role]='Invitación · '+role;
}
const links=Object.entries(stages).map(([stage,title])=>`<a href="${stage}.html" target="preview">${title}</a>`).join('');
fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Correos de Koinonía · Vista previa</title><style>body{margin:0;font:16px Arial,sans-serif;background:#f3f3ed;color:#17232d}header{padding:24px;background:#061a34;color:white}h1{font:30px Georgia,serif}main{display:grid;grid-template-columns:260px 1fr;gap:20px;padding:20px}nav a{display:block;color:#146b65;padding:12px;background:white;margin-bottom:8px;border-radius:8px}iframe{width:100%;height:85vh;border:1px solid #dbe3dc}a:focus-visible{outline:3px solid #c99a4a}@media(max-width:700px){main{grid-template-columns:1fr}nav{display:flex;overflow:auto;gap:8px}nav a{min-width:170px}}</style><header><h1>Correos de Koinonía</h1><p>Muestras con datos ficticios. Los botones contienen una dirección de ejemplo.</p></header><main><nav aria-label="Plantillas">${links}</nav><iframe name="preview" title="Diseño del correo" src="initial.html" sandbox=""></iframe></main></html>`,'utf8');
console.log('Vistas previas guardadas en '+output);
