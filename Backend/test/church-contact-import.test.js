const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),svc=require('../src/services/church-contact-import.service'),f=require('./helpers/outreach-fixture');
let env,admin,church;
before(async()=>{env=await f.start();admin=await f.account();({church}=await f.seed(admin,{name:'Iglesia del Encuentro'}));await require('../src/models/church-contact-import.model').init();});
after(async()=>{if(env)await env.stop();});
test('nombres repetidos no se resuelven por un contacto compartido; diferencias quedan visibles',()=>{
 const c={_id:'1',identification:{name:' Iglesia del Encuentro '},contact:{email:'old@example.org',phone:'+56 9 1234 5678',instagram:'https://www.instagram.com/iglesia/'},location:{commune:'Santiago'}};
 const rows=[{row:2,name:'iglesia del encuentro',email:'new@example.org',phone:'912345678',instagram:'https://instagram.com/iglesia'}];
 const r=svc.matchRows(rows,[c])[0];assert.equal(r.status,'matched');assert.equal(r.candidates[0].comparison.find(c=>c.field==='email').state,'different');assert.equal(r.candidates[0].comparison.find(c=>c.field==='phone').state,'match');assert.equal(r.candidates[0].comparison.find(c=>c.field==='instagram').state,'match');assert.equal(svc.matchRows(rows,[c,{...c,_id:'2'}])[0].status,'ambiguous');
 assert.equal(svc.matchRows([{...rows[0],name:'Iglesia del Encuentros'}],[c])[0].status,'not_found');
 assert.equal(svc.matchRows([...rows,{...rows[0],row:3}],[c])[1].status,'duplicate');
 assert.equal(svc.matchRows(rows,[{...c,mergedInto:'2'}])[0].status,'merged');
});
test('sin correo conserva asociación, correo inválido se identifica y varios correos se separan',()=>{
 const c={_id:'1',identification:{name:'A'}};const r=svc.matchRows([{row:2,name:'A',email:'A@example.org; b@example.org; malo; A@example.org'}],[c])[0];assert.deepEqual(r.recipients,['a@example.org','b@example.org','malo']);assert.deepEqual(r.invalidEmails,['malo']);assert.equal(svc.matchRows([{row:2,name:'A'}],[c])[0].status,'matched');
});
test('API exige admin, vista previa no escribe, confirmación repetida es idempotente y no emite enlaces',async()=>{
 const input={source:'contactos.xlsx · Hoja 1',rows:[{row:2,name:church.identification.name,email:'new@example.org'}]},Batch=require('../src/models/church-contact-import.model'),Access=require('../src/models/church-outreach-access.model'),Invitation=require('../src/models/church-outreach-invitation.model');
 await f.api(env.app,'post','/church-contact-imports/preview',input).expect(401);const member=await f.account('member@example.test','user');await f.api(env.app,'post','/church-contact-imports/preview',input,member).expect(403);
 const prior=await Invitation.countDocuments(),original=JSON.stringify(await f.Church.findById(church.id).lean());
 const preview=await f.api(env.app,'post','/church-contact-imports/preview',input,admin).expect(200);assert.equal(await Batch.countDocuments(),0);assert.equal(preview.body.rows[0].status,'matched');
 const body={...input,digest:preview.body.digest,selectedRows:[2]},one=await f.api(env.app,'post','/church-contact-imports/confirm',body,admin).expect(200),two=await f.api(env.app,'post','/church-contact-imports/confirm',body,admin).expect(200);assert.equal(one.body.id,two.body.id);assert.equal(await Batch.countDocuments(),1);assert.equal(await Access.countDocuments(),0);assert.equal(await Invitation.countDocuments(),prior);assert.equal(JSON.stringify(await f.Church.findById(church.id).lean()),original);
 await f.api(env.app,'post','/church-contact-imports/confirm',{...body,selectedRows:[999]},admin).expect(400);
 const fresh={...input,source:'otro.xlsx'},p=await f.api(env.app,'post','/church-contact-imports/preview',fresh,admin).expect(200);await f.Church.updateOne({_id:church.id},{$set:{'contact.phone':'123456789'}});await f.api(env.app,'post','/church-contact-imports/confirm',{...fresh,digest:p.body.digest,selectedRows:[2]},admin).expect(409);
 await f.api(env.app,'get','/church-contact-imports',undefined,admin).expect(200);
});
