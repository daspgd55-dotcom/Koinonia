import {validLocation,effectiveLocation} from './profile.js';
const same=(a,b)=>String(a||'').trim().toLocaleLowerCase('es')===String(b||'').trim().toLocaleLowerCase('es');
export async function prepareAddress(draft,resolve){
 const v=draft.values,address=String(v.address||'').trim(),commune=String(v.commune||'').trim(),point=v.addressSelection,usesAddress=v.locationSource==='address',confirmed=validLocation(point)&&same(point.address,address)&&same(point.commune,commune)&&!point.token;
 function unverified(){const result={...draft,values:{...v,address,addressSelection:null,...(!address&&usesAddress?{locationSource:'none'}:{})},states:{...draft.states,address:address?'answered':'omitted',addressSelection:'omitted'},dirty:[...new Set([...draft.dirty,'address','addressSelection',...(!address&&usesAddress?['locationSource']:[])])],addressNotice:address?'Guardamos tu dirección como no verificada. No se usará para calcular distancias.':''};if(!effectiveLocation(result)&&draft.modes?.radiusKm==='required'){result.modes={...draft.modes,radiusKm:'preferred'};result.dirty.push('radiusKm');result.addressNotice+=' La distancia máxima queda como preferencia hasta confirmar una ubicación.';}return result;}
 if(!address)return unverified();
 const edited=draft.dirty.some(k=>['address','commune'].includes(k));
 if(!edited&&(!usesAddress||confirmed))return draft;
 if(!commune)return unverified();
 let result;try{result=await resolve({address,commune});}catch(e){if(e.status===401||e.status===403)throw e;return unverified();}
 if(result.data?.length!==1)return unverified();
 return {...draft,values:{...v,addressSelection:result.data[0]},states:{...draft.states,addressSelection:'answered'},dirty:[...new Set([...draft.dirty,'addressSelection'])]};
}
