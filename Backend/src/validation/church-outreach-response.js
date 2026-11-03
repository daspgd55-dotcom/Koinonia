const {z}=require('./schemas');
const name=z.string().trim().min(2).max(100),email=z.string().trim().email().max(254).toLowerCase();
const representative=z.strictObject({name,email,proposedSubrole:z.enum(['administrator','editor','moderator','welcome'])});
const submission=z.strictObject({
 respondent:z.strictObject({name,relationship:z.string().trim().min(2).max(200),email:email.optional()}),
 participates:z.boolean(),representatives:z.array(representative).min(1).max(20),
 consent:z.strictObject({revision:z.string().length(64),terms:z.boolean(),privacy:z.boolean(),authorized:z.literal(true),communications:z.literal(true)})
}).superRefine((v,ctx)=>{
 if(new Set(v.representatives.map(p=>p.email)).size!==v.representatives.length)ctx.addIssue({code:'custom',path:['representatives'],message:'No repitas el mismo correo en el equipo.'});
 if(v.participates&&!v.representatives.some(p=>p.email===v.respondent.email&&p.name===v.respondent.name))ctx.addIssue({code:'custom',path:['respondent'],message:'Incluye tus datos una sola vez en el equipo.'});
 if(!v.participates&&v.respondent.email)ctx.addIssue({code:'custom',path:['respondent','email'],message:'No se necesita tu correo si solo coordinas.'});
});
module.exports=z.discriminatedUnion('answer',[z.strictObject({answer:z.literal('received'),submission}),z.strictObject({answer:z.enum(['wrong_church','wrong_contact','declined','no_contact'])})]);
