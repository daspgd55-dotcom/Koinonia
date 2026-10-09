const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const nameKey = doc => fold(doc.identification?.name);
function addressKey(doc) {
  const street = fold((doc.location?.address || '').split(',')[0]).replace(/\bavenida\b/g,'av').replace(/\balameda libertador bernardo o higgins\b/g,'alameda');
  if (!/\d/.test(street) || /^\d{7}\b/.test(street)) return '';
  return fold(doc.location?.commune) + '|' + street;
}
function similar(a,b) {
  if (nameKey(a)===nameKey(b)) return true;
  const tokens = d => new Set(nameKey(d).split(' ').filter(t=>!['iglesia','de','del','la','el','los','las','en','santiago','chile'].includes(t)));
  const x=tokens(a),y=tokens(b); if(!x.size||!y.size) return false;
  const common=[...x].filter(t=>y.has(t)).length; return common/Math.max(x.size,y.size)>=0.8;
}
function matchRecord(incoming,existing) {
  existing=existing.filter(d=>!d.mergedInto);
  const id=incoming.externalProfile.placeId;
  const exact=existing.filter(d=>d.externalProfile?.provider==='google_maps' && [d.externalProfile.placeId,...(d.externalProfile.aliasPlaceIds||[])].includes(id));
  if(exact.length) return exact.length===1 ? { target:exact[0],reason:'place_id' } : { review:true,reason:'multiple_place_id_matches',candidates:exact };
  const address=addressKey(incoming);
  const addresses=address ? existing.filter(d=>addressKey(d)===address) : [];
  if(addresses.length) {
    if(addresses.length===1 && similar(incoming,addresses[0])) return {target:addresses[0],reason:'address_and_name'};
    return {review:true,reason:'shared_address_requires_review',candidates:addresses};
  }
  const postal=incoming.location?.postalCode;
  const postalMatches=postal ? existing.filter(d=>d.location?.postalCode===postal) : [];
  const names=existing.filter(d=>nameKey(d)===nameKey(incoming));
  if(names.length) return {review:true,reason:'same_name_different_or_missing_address',candidates:names};
  if(postalMatches.some(d=>similar(incoming,d))) return {review:true,reason:'postal_and_similar_name',candidates:postalMatches};
  return {reason:'new_identity',postalCandidates:postalMatches.map(d=>String(d._id))};
}
const unique = (values,key=v=>JSON.stringify(v)) => { const seen=new Map();for(const v of values)if(!seen.has(key(v)))seen.set(key(v),v);return [...seen.values()]; };
function mergeRecord(target,incoming) {
  const result=structuredClone(target), conflicts=[];
  for(const group of ['identification','location','contact']) {
    if(!Object.keys(incoming[group]||{}).length) continue;
    result[group] ||= {};
    for(const [key,value] of Object.entries(incoming[group]||{})) {
      if(result[group][key]===undefined || result[group][key]===null || result[group][key]==='') result[group][key]=value;
      else if(JSON.stringify(result[group][key])!==JSON.stringify(value)) conflicts.push(group+'.'+key);
    }
  }
  const previous=result.externalProfile||{}, next=incoming.externalProfile;
  result.externalProfile={...previous};
  for(const [key,value] of Object.entries(next)) if(previous[key]===undefined || previous[key]==='') result.externalProfile[key]=value;
  if(previous.capturedAt) result.externalProfile.capturedAtBasis=previous.capturedAtBasis||'scrapedAt';
  result.externalProfile.aliasPlaceIds=unique([...(previous.aliasPlaceIds||[]),next.placeId]).filter(id=>id!==result.externalProfile.placeId);
  for(const key of ['categories','links','phones','emails']) result.externalProfile[key]=unique([...(previous[key]||[]),...(next[key]||[])],key==='links'?v=>v.url:undefined);
  // Horarios de capturas sin fecha verificable no sustituyen los existentes.
  if(!previous.openingHours?.length && next.openingHours?.length) result.externalProfile.openingHours=next.openingHours;
  const media=unique([...(target.media||[]),...(incoming.media||[])],v=>v.url);
  if(media.length>30) return {review:true,reason:'media_limit_requires_review'};
  result.media=media;
  const changed=['identification','location','contact','externalProfile','media'].some(k=>JSON.stringify(target[k])!==JSON.stringify(result[k]));
  return {result,changed,conflicts};
}
module.exports={addressKey,similar,matchRecord,mergeRecord};
