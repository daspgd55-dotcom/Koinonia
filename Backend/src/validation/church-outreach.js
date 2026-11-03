const {z,id}=require('./schemas');
const text=max=>z.string().trim().min(1).max(max),email=z.string().trim().toLowerCase().email().max(254);
const create=z.strictObject({
 acknowledgeRelated:z.boolean().default(false),churchId:id,recipient:z.strictObject({email,name:text(100).optional()}),
 contactSource:z.strictObject({kind:z.enum(['institutional_website','institutional_social','direct_contact','administrative_record']),url:z.string().url().max(500).refine(v=>/^https?:\/\//i.test(v),'Usa un enlace HTTP(S)').optional(),collectedAt:z.string().datetime({offset:true}),evidence:text(2000)}).refine(v=>!['institutional_website','institutional_social'].includes(v.kind)||!!v.url,'Indica la URL institucional de procedencia'),
 expiresAt:z.string().datetime({offset:true}),note:text(2000).optional()
});
const action=z.strictObject({action:z.enum(['review_target','expire','revoke','close','no_contact']),reason:text(2000),acknowledgeInactive:z.boolean().default(false),acknowledgeExistingTeam:z.boolean().default(false)});
const list=z.strictObject({page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(50).default(20),churchId:id.optional(),lifecycle:z.enum(['draft','ready','expired','revoked','closed']).optional()});
module.exports={create,action,list};
