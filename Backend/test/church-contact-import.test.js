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
test('sin correo conserva asociaci贸n, correo inv谩lido se identifica y varios correos se separan',()=>{
 const c={_id:'1',identification:{name:'A'}};const r=svc.matchRows([{row:2,name:'A',email:'A@example.org; b@example.org; malo; A@example.org'}],[c])[0];assert.deepEqual(r.recipients,['a@example.org','b@example.org','malo']);assert.deepEqual(r.invalidEmails,['malo']);assert.equal(svc.matchRows([{row:2,name:'A'}],[c])[0].status,'matched');
});
test('API exige admin, vista previa no escribe, confirmaci贸n repetida es idempotente y no emite enlaces',async()=>{
 const input={source:'contactos.xlsx 路 Hoja 1',rows:[{row:2,name:church.identification.name,email:'new@example.org'}]},Batch=require('../src/models/church-contact-import.model'),Access=require('../src/models/church-outreach-access.model'),Invitation=require('../src/models/church-outreach-invitation.model');
 await f.api(env.app,'post','/church-contact-imports/preview',input).expect(401);const member=await f.account('member@example.test','user');await f.api(env.app,'post','/church-contact-imports/preview',input,member).expect(403);
 const prior=await Invitation.countDocuments(),original=JSON.stringify(await f.Church.findById(church.id).lean());
 const preview=await f.api(env.app,'post','/church-contact-imports/preview',input,admin).expect(200);assert.equal(await Batch.countDocuments(),0);assert.equal(preview.body.rows[0].status,'matched');
 const body={...input,digest:preview.body.digest,selectedRows:[2]},one=await f.api(env.app,'post','/church-contact-imports/confirm',body,admin).expect(200),two=await f.api(env.app,'post','/church-contact-imports/confirm',body,admin).expect(200);assert.equal(one.body.id,two.body.id);assert.equal(await Batch.countDocuments(),1);assert.equal(await Access.countDocuments(),0);assert.equal(await Invitation.countDocuments(),prior);assert.equal(JSON.stringify(await f.Church.findById(church.id).lean()),original);
 await f.api(env.app,'post','/church-contact-imports/confirm',{...body,selectedRows:[999]},admin).expect(400);
 const fresh={...input,source:'otro.xlsx'},p=await f.api(env.app,'post','/church-contact-imports/preview',fresh,admin).expect(200);await f.Church.updateOne({_id:church.id},{$set:{'contact.phone':'123456789'}});await f.api(env.app,'post','/church-contact-imports/confirm',{...fresh,digest:p.body.digest,selectedRows:[2]},admin).expect(409);
 await f.api(env.app,'get','/church-contact-imports',undefined,admin).expect(200);
});

test('resolver actualiza campos elegidos y crea iglesia con asociaci贸n at贸mica e idempotente',async()=>{
 const input={source:'resolver.xlsx',rows:[{row:7,name:church.identification.name,email:'nuevo@example.org',phone:'912345678'}]};
 const p=await f.api(env.app,'post','/church-contact-imports/preview',input,admin).expect(200),candidate=p.body.rows[0].candidates[0];
 const body={source:input.source,row:input.rows[0],mode:'update',churchId:church.id,fingerprint:candidate.fingerprint,fields:['phone']};
 const before=await f.Church.findById(church.id).lean();
 const result=await f.api(env.app,'post','/church-contact-imports/resolve',body,admin).expect(200);
 const updated=await f.Church.findById(church.id).lean();assert.equal(updated.contact.phone,'912345678');assert.equal(updated.contact.email,before.contact.email);
 const again=await f.api(env.app,'post','/church-contact-imports/resolve',body,admin).expect(200);assert.equal(result.body.id,again.body.id);
 await f.api(env.app,'post','/church-contact-imports/resolve',{...body,fields:['email']},admin).expect(409);
 const row={row:8,name:'Iglesia nueva real de prueba aislada',commune:'Santiago',email:'nueva@example.org'},source='crear.xlsx';
 const preview=await f.api(env.app,'post','/church-contact-imports/preview',{source,rows:[row]},admin).expect(200);
 const create={source,row,mode:'create',fields:['email','commune'],digest:preview.body.digest,latitude:-33.4,longitude:-70.6};
 await f.api(env.app,'post','/church-contact-imports/resolve',{...create,latitude:undefined},admin).expect(400);
 const created=await f.api(env.app,'post','/church-contact-imports/resolve',create,admin).expect(200);
 const repeat=await f.api(env.app,'post','/church-contact-imports/resolve',create,admin).expect(200);assert.equal(created.body.churchId,repeat.body.churchId);
 const c=await f.Church.findById(created.body.churchId);assert.equal(c.active,false);assert.equal(c.metadata.dataStatus,'draft');assert.equal(c.contact.email,'nueva@example.org');
 const batch=await require('../src/models/church-contact-import.model').findById(created.body.id);assert.deepEqual([...batch.associations[0].recipients],['nueva@example.org']);assert.equal(String(batch.associations[0].church),c.id);
 const bad={...create,source:'invalid.xlsx',row:{...row,name:'No guardar'},latitude:Infinity};await f.api(env.app,'post','/church-contact-imports/resolve',bad,admin).expect(400);assert.equal(await f.Church.countDocuments({'identification.name':'No guardar'}),0);
});

test('campa馻 deduplica asociaciones y reserva Make sin correo Resend',async()=>{
 const Import=require('../src/models/church-contact-import.model'),svc=require('../src/services/church-campaign.service'),Invitation=require('../src/models/church-outreach-invitation.model');
 await f.Church.updateOne({_id:church.id},{$set:{'metadata.testData':true}});
 const batches=await Import.find();const ids=batches.map(b=>b.id),p=await svc.preview(ids),rows=p.rows.filter(r=>r.eligible);assert.ok(rows.length);assert.ok(rows.some(r=>r.churchId===church.id&&r.testData));
 const result=await svc.prepare({imports:ids,digest:p.digest,keys:rows.map(r=>r.key),reviewed:rows.map(r=>r.key)},admin);assert.equal(result.count,rows.length);
 const row=await Invitation.findById(result.ids[0]);assert.equal(row.initialChannel,'make');
 const preview=await require('../src/services/church-outreach-mail.service').plans([{invitation:row.id,kind:'institutional',reminder:false}],f.cfg);assert.ok(preview.items[0].reasons.includes('reserved_for_make'));
 const again=await svc.preview(ids);assert.equal(again.rows.filter(r=>r.eligible).length,0);
});

test('cola Make cifra enlace, conserva token en reintentos y admite solicitud de renovaci髇 sin exponerlo',async()=>{
 const Message=require('../src/models/church-make-message.model'),Access=require('../src/models/church-outreach-access.model'),svc=require('../src/services/church-make-queue.service');await Message.init();
 const message=await Message.findOne({state:'pending'});assert.ok(message);
 await svc.prepare(message.id,f.cfg);const first=await Message.findById(message.id).select('+payload');assert.equal(first.state,'prepared');assert.ok(!first.payload.includes('token='));assert.ok(!first.payload.includes('@'));
 await svc.prepare(message.id,f.cfg);const second=await Message.findById(message.id).select('+payload');assert.equal(first.payload,second.payload);assert.equal(String(first.access),String(second.access));
 const content=require('../src/services/mail-queue.service').open(first.payload,first.payloadId,f.cfg),token=content.text.match(/token=([a-f0-9]{64})/)[1];
 assert.ok(!(await svc.renew(token)).message.includes(token));assert.equal(await Message.countDocuments({kind:'renewal'}),0);
 await Access.updateOne({_id:first.access},{$set:{expiresAt:new Date(Date.now()-1000)}});await Message.updateOne({_id:first.id},{$set:{expiresAt:new Date(Date.now()-1000)}});
 await svc.renew(token);await svc.renew(token);assert.equal(await Message.countDocuments({kind:'renewal',invitation:first.invitation}),1);
 const listed=await f.api(env.app,'get','/church-make-messages',undefined,admin).expect(200);assert.ok(!JSON.stringify(listed.body).includes(first.payload));
});

test('Make autentica, reserva sin duplicar, autoriza una vez y confirma idempotentemente',async()=>{
 const svc=require('../src/services/make-outreach.service'),Message=require('../src/models/church-make-message.model'),crypto=require('node:crypto');
 env.app.locals.config.makeOutreach={enabled:true,keyHash:crypto.createHash('sha256').update('isolated-make-key').digest('hex')};
 await f.api(env.app,'post','/integrations/make/outreach/claim',{}).expect(401);
 const a=await svc.claim(f.cfg);assert.equal(a.messages.length,1);const m=a.messages[0],input={dispatchId:m.dispatchId,reservationToken:m.reservationToken};
 const other=await svc.claim(f.cfg);assert.ok(other.messages.every(x=>x.dispatchId!==m.dispatchId));
 assert.equal((await svc.check({...input,reservationToken:'0'.repeat(64)})).allowed,false);
 assert.equal((await svc.check(input)).allowed,true);assert.equal((await svc.check(input)).allowed,false);
 const result={...input,status:'accepted',providerId:'gmail-isolated'};assert.equal((await svc.result(result)).state,'accepted');assert.equal((await svc.result(result)).state,'accepted');
 assert.equal((await Message.findById(m.dispatchId)).state,'accepted');
 const r=await f.api(env.app,'post','/integrations/make/outreach/claim',{},null,{'X-Make-Key':'isolated-make-key'}).expect(200);assert.ok(r.body.messages.every(x=>x.dispatchId!==m.dispatchId));
});
