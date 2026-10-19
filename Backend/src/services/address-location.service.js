const jwt=require('jsonwebtoken');
const {HttpError}=require('../utils/errors');
const normalize=v=>String(v||'').trim().toLocaleLowerCase('es');
const fold=v=>normalize(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const validPoint=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
function confirmedAddress(context,preferences){const p=context?.addressPoint;return validPoint(p)&&normalize(p.address)===normalize(context.address)&&normalize(p.commune)===normalize(preferences?.commune)?p:null;}
function referenceLocation(preferences,context={}){return context.locationSource==='none'?null:context.locationSource==='address'?confirmedAddress(context,preferences):preferences?.location;}
async function resolveAddress(config,user,address,commune){
 const number=address.match(/\b(\d+[a-z]?)\s*$/i)?.[1];
 if(!number||!/[a-záéíóúñ]/i.test(address))throw new HttpError(400,'ADDRESS_INCOMPLETE','Indica calle y número, sin departamento, y la comuna.');
 if(!config.geocoding?.apiKey)throw new HttpError(503,'GEOCODING_UNAVAILABLE','La comprobación de direcciones todavía no está disponible. Puedes usar la ubicación del dispositivo.');
 const url=new URL('https://api.geoapify.com/v1/geocode/search');url.search=new URLSearchParams({text:`${address}, ${commune}, Región Metropolitana, Chile`,format:'json',lang:'es',filter:'countrycode:cl',limit:'5',apiKey:config.geocoding.apiKey});
 let body;
 try{const response=await (config.geocoding.fetch||fetch)(url,{signal:AbortSignal.timeout(6000),redirect:'error'});if(!response.ok)throw Error();const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>131072)throw Error();chunks.push(chunk);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!Array.isArray(body.results))throw Error();}
 catch{throw new HttpError(503,'GEOCODING_UNAVAILABLE','No pudimos comprobar la dirección ahora. Inténtalo nuevamente.');}
 const seen=new Set(),candidates=[];
 for(const p of body.results){
  if(!p||typeof p!=='object')continue;
  const point={lat:Number(p.lat),lng:Number(p.lon)},sameCommune=[p.city,p.city_district,p.suburb,p.district,p.municipality].some(v=>fold(v)===fold(commune));
  if(!validPoint(point)||point.lat< -33.85||point.lat> -33.1||point.lng< -71||point.lng> -70.3||p.country_code!=='cl'||!sameCommune||!p.street||normalize(p.housenumber)!==normalize(number)||!['building','amenity'].includes(p.result_type)||!(p.rank?.confidence>=.8))continue;
  const label=String(p.formatted||`${p.street} ${p.housenumber}, ${commune}`).slice(0,500),key=point.lat+','+point.lng;if(seen.has(key))continue;seen.add(key);
  const data={lat:+point.lat.toFixed(3),lng:+point.lng.toFixed(3),label,address,commune,verifiedAt:new Date().toISOString()};
  candidates.push({...data,token:jwt.sign(data,config.jwtSecret,{algorithm:'HS256',subject:String(user._id),issuer:'koinonia-address',audience:'address-confirmation',expiresIn:'15m'})});
 }
 return candidates.slice(0,3);
}
function verifyAddress(token,config,user,address,commune){
 try{const p=jwt.verify(token,config.jwtSecret,{algorithms:['HS256'],issuer:'koinonia-address',audience:'address-confirmation',subject:String(user._id)});if(!validPoint(p)||normalize(p.address)!==normalize(address)||normalize(p.commune)!==normalize(commune))throw Error();return Object.fromEntries(['lat','lng','label','address','commune','verifiedAt'].map(k=>[k,p[k]]));}
 catch{throw new HttpError(400,'ADDRESS_CONFIRMATION_EXPIRED','Comprueba nuevamente la dirección: cambió o venció su confirmación.');}
}
module.exports={resolveAddress,verifyAddress,referenceLocation,confirmedAddress};
