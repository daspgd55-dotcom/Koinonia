const {z,id,church}=require('./schemas');
const categories=['gathering','community_service','evangelism','retreat','workshop','cultural','other'];
const publicationStatuses=['draft','published','archived'],eventStatuses=['scheduled','cancelled'];
const text=z.string().trim().min(1).max(200),long=z.string().trim().max(10000),url=z.string().url().max(2000).refine(v=>/^https?:\/\//i.test(v),'Solo URLs HTTP/HTTPS');
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;},'Fecha de calendario inválida');
// Sin sufijo significa hora local del piloto, siempre UTC-3. Nunca depende de TZ del host.
function instant(value){
 const m=/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(\.\d{1,3})?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)?$/.exec(value);
 if(!m||!day.safeParse(m[1]).success||(/[+-]14:(?!00)/.test(m[6]||'')))return null;
 const d=new Date(value+(m[6]?'':'-03:00'));return Number.isFinite(+d)?d:null;
}
const date=z.string().refine(v=>instant(v)!==null,'Usa una fecha válida YYYY-MM-DDTHH:mm, con zona opcional').transform(instant);
const location=church.shape.location.pick({address:true,commune:true,city:true,region:true,countryCode:true,coordinates:true}).partial({coordinates:true});
const cover=church.shape.media.unwrap().element.omit({leaderId:true,category:true,type:true});
const fields=z.strictObject({title:text,openCollaboration:z.boolean().default(false),description:long.default(''),category:z.enum(categories).default('other'),communityId:id.nullable().default(null),
 startsAt:date.nullable().default(null),endsAt:date.nullable().default(null),modality:z.enum(['in_person','online','hybrid']).default('in_person'),
 venue:text.nullable().default(null),location:location.nullable().default(null),onlineUrl:url.nullable().default(null),audience:z.array(text).max(50).default([]),
 cover:cover.nullable().default(null),participation:z.enum(['free','registration','invitation']).default('free'),participationConditions:long.default(''),registrationInstructions:long.default(''),registrationUrl:url.nullable().default(null),
 contact:church.shape.contact.unwrap().default({}),privateFields:z.strictObject({email:z.boolean().default(false),phone:z.boolean().default(false)}).default({email:false,phone:false})});
function coherent(v,ctx){
 const issue=(path,message)=>ctx.addIssue({code:'custom',path:[path],message});
 if(v.endsAt&&(!v.startsAt||v.endsAt<=v.startsAt))issue('endsAt','El término debe ser posterior al inicio');
 if(v.modality==='online'&&v.location)issue('location','Un evento en línea no tiene dirección presencial; elimina location o usa modalidad mixta');
 if(v.modality==='in_person'&&v.onlineUrl)issue('onlineUrl','Usa modalidad mixta para ofrecer acceso presencial y en línea');
}
const create=fields.extend({churchId:id}).superRefine(coherent),content=fields.superRefine(coherent);
const patch=z.strictObject(Object.fromEntries(Object.entries(fields.shape).map(([k,v])=>[k,(v instanceof z.ZodDefault?v.removeDefault():v).optional()]))).refine(v=>Object.keys(v).length>0,'Indica al menos un campo');
const publication=z.strictObject({publicationStatus:z.enum(publicationStatuses)});
const state=z.discriminatedUnion('eventStatus',[z.strictObject({eventStatus:z.literal('cancelled'),cancellationReason:z.string().trim().min(5).max(1000)}),z.strictObject({eventStatus:z.literal('scheduled')})]);
const queryFields={q:text.optional(),associatedChurchId:id.optional(),churchId:id.optional(),communityId:id.optional(),category:z.enum(categories).optional(),commune:text.optional(),audience:text.optional(),dateFrom:day.optional(),dateTo:day.optional(),view:z.enum(['upcoming','past','all']).default('upcoming'),page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(100).default(20)};
const validRange=v=>!v.dateFrom||!v.dateTo||v.dateFrom<=v.dateTo;
const query=z.strictObject(queryFields).refine(validRange,'dateFrom no puede ser posterior a dateTo');
const managedQuery=z.strictObject({...queryFields,view:queryFields.view.removeDefault().default('all'),publicationStatus:z.enum(publicationStatuses).optional(),eventStatus:z.enum(eventStatuses).optional()}).refine(validRange,'dateFrom no puede ser posterior a dateTo');
module.exports={categories,publicationStatuses,eventStatuses,fields,create,content,patch,publication,state,query,managedQuery,instant};
