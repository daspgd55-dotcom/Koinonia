const {randomBytes}=require('node:crypto'),Batch=require('../models/church-outreach-mail-batch.model'),Mail=require('../models/church-outreach-mail.model'),Invitation=require('../models/church-outreach-invitation.model'),Member=require('../models/church-outreach-member.model'),Access=require('../models/church-outreach-access.model'),Contact=require('../models/church-outreach-contact.model'),Church=require('../models/church.model'),Job=require('../models/mail-job.model'),Event=require('../models/church-outreach-event.model'),base=require('./church-outreach.service'),queue=require('./mail-queue.service'),{hash,quota}=require('./account-security.service'),templates=require('./church-outreach-mail-templates'),{HttpError}=require('../utils/errors');
const conflict=message=>new HttpError(409,'OUTREACH_MAIL_CONFLICT',message),identity=s=>[String(s.invitation),s.kind,s.email||''].join(':'),contactKey=(church,email)=>hash(String(church)+'\n'+email);
function capabilities(cfg){return {enabled:cfg.outreachMail?.enabled===true,queueEnabled:queue.enabled(cfg),configured:!!(cfg.mail&&(!queue.enabled(cfg)||cfg.mailQueue)),manualUrl:cfg.outreachMail?.manualUrl||null,scheduled:false};}
// Resolve reverse aliases too: a suppression on an older merged card must survive the merge.
async function family(id,session=null){const ids=[id];let frontier=[id];for(let depth=0;frontier.length&&depth<50;depth++){const rows=await Church.find({mergedInto:{$in:frontier}}).select('_id').session(session).lean();frontier=rows.map(r=>r._id).filter(v=>!ids.some(id=>String(id)===String(v)));ids.push(...frontier);if(ids.length>1000)throw conflict('La identidad de iglesia requiere revisar sus fusiones.');}if(frontier.length)throw conflict('La cadena de fusiones excede el límite operativo.');return ids;}
async function suppressed(church,email,session=null){const ids=await family(church,session);return !!await Contact.exists({church:{$in:ids},email,$or:[{noContact:true},{deliveryBlocked:true}]}).session(session);}
async function plan(selection,cfg,session=null){
 const row=await Invitation.findById(selection.invitation).session(session),reasons=[];if(!row)return {selection,reasons:['invitation_missing'],eligible:false};
 const member=selection.kind==='member'?await Member.findOne({invitation:row._id,email:selection.email}).session(session):null,church=await Church.findById(row.church).session(session).lean(),email=selection.kind==='member'?member?.email:row.recipient.email;
 if(!church||church.mergedInto)reasons.push('church_missing_or_merged');if(church?.metadata?.testData||church?.testOnly||church?.importInfo?.batchId?.includes('synthetic'))reasons.push('test_data');
 if(!row.active||row.expiresAt<=new Date()||row.noContact?.requested)reasons.push('cycle_closed_expired_or_suppressed');
 if(email&&await suppressed(row.church,email,session))reasons.push('no_contact_or_permanent_delivery_failure');
 if(row.noContact?.requested||await suppressed(row.church,row.recipient.email,session))reasons.push('institutional_contact_stopped');
 const target=await base.inspectTarget(row.church,session);if(!base.readiness(row,target,await Contact.findById(row.contactKey).session(session)).preparationReady)reasons.push('target_review_required');
 if(selection.kind==='institutional'){
  if(!['awaiting_response','needs_clarification'].includes(row.response.state))reasons.push('already_responded');
  if(selection.reminder&&row.response.state!=='awaiting_response')reasons.push('reminder_after_response');
  const legal=require('../config/church-outreach-legal').current();if(!legal.enabled||legal.testBypass)reasons.push('legal_texts_pending');
 }else if(!member||!member.active||!['prepared','pending'].includes(member.state)||member.expiresAt<=new Date()||row.proposedRepresentatives.find(p=>p.email===email)?.reviewState!=='approved')reasons.push('member_not_pending');
 const sourceRevision=selection.kind==='member'?member?.approvedAt?.toISOString():row.response.state==='needs_clarification'?row.communications?.at(-1)?.at?.toISOString():'initial';
 const history=await Mail.find({invitation:row._id,kind:selection.kind,...(member?{member:member._id}:{}),sourceRevision}).sort({createdAt:1}).session(session).lean(),last=history.at(-1);
 if(selection.reminder){if(!history.some(m=>!m.reminder&&['accepted','delivered'].includes(m.state)&&m.source==='provider'))reasons.push('initial_not_accepted');if(history.filter(m=>m.reminder).length>=2)reasons.push('reminder_limit');if(last&&Date.now()-new Date(last.acceptedAt||last.createdAt).getTime()<72*3600000)reasons.push('reminder_cooldown');if(history.some(m=>['queued','failed','bounced','complained'].includes(m.state)))reasons.push('delivery_unresolved_or_stopped');}
 else if(history.some(m=>!m.reminder))reasons.push('initial_already_prepared');
 const lastIssued=selection.kind==='member'?member?.issuedAt:row.lastLinkIssuedAt;if(lastIssued&&Date.now()-lastIssued.getTime()<60000)reasons.push('link_cooldown');
 const content=church&&(selection.kind==='institutional'||member)?templates.render({kind:selection.kind,church,role:member?.subrole,source:row.contactSource.kind,clarification:row.response.state==='needs_clarification'?row.communications?.at(-1)?.text:null,reminder:selection.reminder,link:'[ENLACE PERSONAL GENERADO AL CONFIRMAR]',manualUrl:cfg.outreachMail?.manualUrl}):null;
 return {selection,sender:cfg.mail?.from||null,frontendOrigin:cfg.mail?.appUrl||null,invitationVersion:row.version,memberVersion:member?.version,memberId:member?._id,churchId:row.church,churchName:church?.identification?.name,email,sourceRevision,sequence:history.filter(m=>m.reminder).length+1,eligible:!reasons.length,reasons,content};
}
async function plans(selections,cfg,session=null){const items=[];for(const selection of selections)items.push(await plan(selection,cfg,session));return {items,digest:hash(JSON.stringify(items)),capabilities:capabilities(cfg)};}
async function prepare(selections,key,actor,cfg){const requestKey=hash(String(actor._id)+':'+key),requestHash=hash(JSON.stringify(selections)),prior=await Batch.findOne({requestKey});if(prior){if(prior.requestHash!==requestHash)throw conflict('La clave de preparación ya tiene otros destinatarios.');return prior;}const preview=await plans(selections,cfg);try{return await Batch.create({createdBy:actor._id,requestKey,requestHash,digest:preview.digest,selections,preview,expiresAt:new Date(Date.now()+86400000)});}catch(e){if(e.code!==11000)throw e;const row=await Batch.findOne({requestKey});if(row?.requestHash!==requestHash)throw conflict('La clave de preparación ya se utilizó.');return row;}}
async function enqueue(id,version,actor,cfg,fetcher){
 const caps=capabilities(cfg);if(!caps.enabled||!caps.configured)throw conflict('Configura el transporte de correo y habilita OUTREACH_MAIL_ENABLED en el backend.');
 await quota(cfg,'outreach-batch-admin',String(actor._id),5,3600000);
 const direct=[];const result=await Batch.db.transaction(async session=>{
  direct.length=0;const batch=await Batch.findById(id).session(session);if(!batch)throw conflict('Lote no disponible.');if(batch.state==='queued')return batch;
  if(batch.state!=='prepared'||batch.version!==version||batch.expiresAt<=new Date())throw conflict('El lote cambió, venció o fue cancelado.');const preview=await plans(batch.selections,cfg,session);if(preview.digest!==batch.digest)throw conflict('Cambió el contexto o la vista previa. Prepara y revisa otro lote.');if(preview.items.some(p=>!p.eligible))throw conflict('El lote contiene exclusiones. Prepara otro con destinatarios habilitados.');
  for(const item of preview.items){
   await quota(cfg,'outreach-mail-recipient',item.email,3,86400000);
   const row=await Invitation.findById(item.selection.invitation).session(session);await base.lockContact(row,session);const member=item.memberId?await Member.findById(item.memberId).select('+tokenHash').session(session):null,now=new Date(),raw=randomBytes(32).toString('hex'),tokenHash=hash(raw),expiresAt=new Date(Math.min(Date.now()+7*86400000,row.expiresAt.getTime(),member?.expiresAt?.getTime()||Infinity));let access;
   if(member){member.tokenHash=tokenHash;member.expiresAt=expiresAt;member.issuedAt=now;member.state='pending';member.version++;await member.save({session});}else{await Access.updateMany({invitation:row._id,revokedAt:null},{$set:{revokedAt:now}},{session});[access]=await Access.create([{invitation:row._id,tokenHash,purpose:'institutional_link',expiresAt}],{session});row.lastLinkIssuedAt=now;}
   const church=await Church.findById(row.church).session(session),link=cfg.mail.appUrl+'/#/'+(member?'invitacion-equipo':'invitacion-iglesia')+'?token='+raw,content=templates.render({kind:item.selection.kind,church,role:member?.subrole,source:row.contactSource.kind,clarification:row.response.state==='needs_clarification'?row.communications?.at(-1)?.text:null,reminder:item.selection.reminder,link,manualUrl:cfg.outreachMail?.manualUrl});
   const mail=new Mail({batch:batch._id,invitation:row._id,church:row.church,email:item.email,kind:item.selection.kind,member:member?._id,reminder:item.selection.reminder,sourceRevision:item.sourceRevision,templateVersion:templates.version,logicalKey:hash(identity(item.selection)+':'+item.sourceRevision+':'+(item.selection.reminder?'reminder-'+item.sequence:'initial'))});
   const guard={outreach:true,mail:String(mail._id),access:access?._id?.toString(),member:member?._id?.toString(),hash:tokenHash,expiresAt,reminder:item.selection.reminder};
   if(caps.queueEnabled){const entry=queue.entry(cfg,item.email,content.subject,content.text,guard);mail.jobId=entry.id;mail.mailOutbox=[entry];}
   else{mail.jobId=require('node:crypto').randomUUID();direct.push({id:mail._id,jobId:mail.jobId,guard,data:{from:cfg.mail.from,email:item.email,subject:content.subject,text:content.text}});}
   await mail.save({session});
   if(member){member.lastMail=mail._id;await member.save({session});}else{row.lastMail=mail._id;row.delivery={state:'queued',updatedAt:now,attempts:0};}row.version++;await row.save({session});await Event.create([{invitation:row._id,actor:actor._id,actorType:'admin',action:'mail_queued',memberEmail:member?.email,reason:'Lote '+batch._id+'; '+(item.selection.reminder?'recordatorio':'invitación')+' preparado sin afirmar entrega.',invitationVersion:row.version}],{session});
  }
  batch.state='queued';batch.queuedBy=actor._id;batch.queuedAt=new Date();batch.version++;await batch.save({session});return batch;
 });
 for(const item of direct){
  const allowed=await validGuard(item.guard,cfg);
  let outcome={ok:false};if(allowed){try{outcome=await queue.deliver(cfg,item.data,item.jobId,fetcher);}catch{/* Resultado incierto, no duplicar automáticamente. */}}
  const state=!allowed?'cancelled':outcome.ok?'accepted':'failed',now=new Date();
  await Mail.updateOne({_id:item.id,state:'queued'},{$set:{state,attempts:allowed?1:0,source:fetcher?'simulated':'provider',providerId:outcome.providerId,acceptedAt:outcome.ok?now:undefined}});
  if(!item.guard.member)await Invitation.updateOne({lastMail:item.id},{$set:{'delivery.state':state,'delivery.updatedAt':now,'delivery.attempts':allowed?1:0}});
 }
 return result;
}
async function cancel(id,version,actor){return Batch.db.transaction(async session=>{const batch=await Batch.findById(id).session(session);if(!batch||batch.version!==version)throw conflict('El lote cambió.');if(batch.state==='cancelled')return batch;batch.state='cancelled';batch.cancelledBy=actor._id;batch.cancelledAt=new Date();batch.version++;await batch.save({session});await Mail.updateMany({batch:id,state:'queued'},{$set:{state:'cancelled',stoppedAt:new Date(),mailOutbox:[]}},{session});const rows=await Mail.find({batch:id}).select('jobId state').session(session);await Invitation.updateMany({lastMail:{$in:rows.filter(m=>m.state==='cancelled').map(m=>m._id)}},{$set:{'delivery.state':'cancelled','delivery.updatedAt':new Date()}},{session});await Job.updateMany({_id:{$in:rows.map(m=>m.jobId)},state:{$in:['pending','retry','processing']}},{$set:{state:'obsolete',failure:'outreach_batch_cancelled'},$unset:{payload:1,owner:1,leaseUntil:1}},{session});return batch;});}
async function validGuard(g,cfg){
 if(!cfg.outreachMail?.enabled)return false;const mail=await Mail.findById(g.mail),batch=mail&&await Batch.findById(mail.batch);if(!mail||batch?.state!=='queued'||!['queued','accepted'].includes(mail.state))return false;
 const row=await Invitation.findById(mail.invitation);if(!row||!row.active||row.expiresAt<=new Date()||row.noContact?.requested||await suppressed(row.church,mail.email)||await suppressed(row.church,row.recipient.email))return false;
 const target=await base.inspectTarget(row.church);if(!base.readiness(row,target,await Contact.findById(row.contactKey)).preparationReady)return false;
 if(g.member)return !!await Member.exists({_id:g.member,invitation:row._id,email:mail.email,state:'pending',active:true,tokenHash:g.hash,expiresAt:{$gt:new Date()}})&&row.proposedRepresentatives.some(p=>p.email===mail.email&&p.reviewState==='approved');
 if(!['awaiting_response','needs_clarification'].includes(row.response.state)||(g.reminder&&row.response.state!=='awaiting_response')||!require('../config/church-outreach-legal').current().enabled||require('../config/church-outreach-legal').current().testBypass)return false;
 return !!await Access.exists({_id:g.access,invitation:row._id,tokenHash:g.hash,purpose:'institutional_link',consumedAt:null,revokedAt:null,expiresAt:{$gt:new Date()}});
}
module.exports={capabilities,plans,prepare,enqueue,cancel,validGuard,contactKey};
