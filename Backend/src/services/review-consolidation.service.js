const {addressKey}=require('./import-merge.service');
const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const FIELDS=['identification','location','christianIdentity','doctrine','meetings','community','leadership','contact','firstVisit','media','externalProfile'];
function score(c){
 const paths=['identification.name','identification.description','identification.abbreviation','location.address','location.commune','location.coordinates','location.postalCode','contact.phone','contact.email','contact.website','contact.facebook','contact.instagram','contact.youtube','externalProfile.openingHours','externalProfile.links','externalProfile.phones','externalProfile.emails','media','doctrine.officialStatement','meetings','leadership.mainLeader.name','community.activities'];
 return paths.reduce((n,p)=>{const v=p.split('.').reduce((a,k)=>a?.[k],c);return n+(v!==undefined&&v!==null&&v!==''&&(!Array.isArray(v)||v.length>0)?1:0)},0);
}
function date(c){return c.externalProfile?.capturedAtBasis==='export_filename_timezone_unknown'?0:(Date.parse(c.externalProfile?.capturedAt)||0);}
function complement(a,b,key=''){
 if(a===undefined||a===null||a==='')return structuredClone(b);
 if(Array.isArray(a)&&Array.isArray(b)){
  if(key==='coordinates')return a;
  const map=new Map();for(const v of [...a,...b]){const k=v?.url||JSON.stringify(v);if(!map.has(k))map.set(k,v);}return [...map.values()];
 }
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
  const r={...a};for(const [k,v] of Object.entries(b))r[k]=complement(r[k],v,k);return r;
 }
 return a;
}
function planReview(inventory,existing){
 const nodes=existing.filter(c=>!c.mergedInto).map(c=>({church:c,existing:c}));
 for(const item of inventory.filter(i=>i.decision==='candidate'))for(const o of item.observations)nodes.push({church:o.record.church,record:o.record,item});
 const parent=nodes.map((_,i)=>i);const root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));const union=(a,b)=>{parent[root(b)]=root(a)};
 const keys=new Map(),generic=new Set(['iglesia','iglesia evangelica','iglesia pentecostal unida','santa maria','santa ana','san jose','las asambleas de dios','ejercito de salvacion']);
 nodes.forEach((n,i)=>{
  const c=n.church,p=c.externalProfile||{},name=fold(c.identification?.name),addr=addressKey(c);
  const ids=[p.placeId,...(p.aliasPlaceIds||[])].filter(Boolean).map(x=>'id:'+x);
  if(addr)ids.push('address:'+addr);
  if(name.length>5&&!generic.has(name))ids.push('name:'+fold(c.location?.commune)+':'+name);
  for(const k of ids){if(keys.has(k))union(i,keys.get(k));else keys.set(k,i);}
 });
 const groups=new Map();nodes.forEach((n,i)=>{const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n)});
 const plans=[];
 for(const group of groups.values()){
  if(!group.some(n=>n.item))continue;
  const ranked=group.slice().sort((a,b)=>score(b.church)-score(a.church)||date(b.church)-date(a.church)||String(a.church.externalProfile?.placeId).localeCompare(String(b.church.externalProfile?.placeId)));
  const old=ranked.filter(n=>n.existing),winner=ranked[0];
  const externalKeys=[...new Set(group.filter(n=>n.item).map(n=>n.item.externalKey))].sort();
  const base={externalKeys,name:winner.church.identification.name,existingIds:old.map(n=>String(n.church._id)),winner:{placeId:winner.church.externalProfile?.placeId,score:score(winner.church),capturedAt:winner.church.externalProfile?.capturedAt,basis:winner.church.externalProfile?.capturedAtBasis||'scrapedAt'},observations:group.length};
  if(old.some(n=>!n.church.metadata?.testData||n.church.verification?.authorized||!n.church.active)){
   plans.push({...base,action:'review',reason:'existing_institutional_or_inactive_record'});continue;
  }
  let content={};for(const n of ranked)for(const key of FIELDS)if(n.church[key]!==undefined)content[key]=complement(content[key],n.church[key],key);
  const oldAnchor=old[0]?.church;
  const aliases=[...new Set(group.flatMap(n=>[n.church.externalProfile?.placeId,...(n.church.externalProfile?.aliasPlaceIds||[]) ]).filter(Boolean))];
  // Mantener la identidad principal de Mongo y del proveedor; los datos descriptivos siguen a la ficha ganadora.
  if(oldAnchor?.externalProfile){content.externalProfile.placeId=oldAnchor.externalProfile.placeId;content.externalProfile.mapsUrl=oldAnchor.externalProfile.mapsUrl;}
  content.externalProfile.aliasPlaceIds=aliases.filter(x=>x!==content.externalProfile.placeId);
  const mediaOverflow=(content.media||[]).slice(30);if(content.media)content.media=content.media.slice(0,30);
  const provenance=ranked.find(n=>n.record)?.record;
  plans.push({...base,action:old.length?'merge':'insert',anchorId:oldAnchor?String(oldAnchor._id):undefined,loserIds:old.slice(1).map(n=>String(n.church._id)),content,provenance,mediaOverflow});
 }
 return plans;
}
module.exports={score,date,complement,planReview};
