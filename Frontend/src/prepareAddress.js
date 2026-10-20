import {validLocation} from './profile.js';
const same=(a,b)=>String(a||'').trim().toLocaleLowerCase('es')===String(b||'').trim().toLocaleLowerCase('es');
export async function prepareAddress(draft,resolve){
 const v=draft.values,address=String(v.address||'').trim(),commune=String(v.commune||'').trim(),point=v.addressSelection,usesAddress=v.locationSource==='address',confirmed=validLocation(point)&&same(point.address,address)&&same(point.commune,commune)&&!point.token;
 if(usesAddress&&!address)throw Error('Indica una dirección o desmarca la opción de preferir tu dirección.');
 const edited=draft.dirty.some(k=>['address','commune'].includes(k));
 if(!address||(!edited&&(!usesAddress||confirmed)))return draft;
 if(!commune)throw Error('Indica la comuna para comprobar tu dirección.');
 const result=await resolve({address,commune});
 if(!result.data?.length)throw Error('No pudimos confirmar tu dirección. Revisa la calle, el número y la comuna antes de guardar.');
 if(result.data.length!==1)throw Error('La dirección coincide con más de un lugar. Escribe la calle, el número y la comuna con mayor precisión.');
 return {...draft,values:{...v,addressSelection:result.data[0]},states:{...draft.states,addressSelection:'answered'},dirty:[...new Set([...draft.dirty,'addressSelection'])]};
}
