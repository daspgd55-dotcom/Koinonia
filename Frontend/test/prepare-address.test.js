import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAddress} from '../src/prepareAddress.js';
const draft=(source='address')=>({values:{address:'Calle 123',commune:'Santiago',locationSource:source},states:{},dirty:['address']});
const point={address:'Calle 123',commune:'Santiago',lat:-33.45,lng:-70.65};
test('comprueba al guardar una dirección editada con cualquier fuente sin mutar respuestas',async()=>{
 for(const source of ['address','device','none']){const input=draft(source),copy=structuredClone(input);let calls=0;const result=await prepareAddress(input,async body=>{calls++;assert.deepEqual(body,{address:'Calle 123',commune:'Santiago'});return {data:[{...point,token:'signed'}]};});assert.equal(calls,1);assert.equal(result.values.addressSelection.token,'signed');assert.ok(result.dirty.includes('addressSelection'));assert.deepEqual(input,copy);}
});
test('ausencia, ambigüedad y fallo conservan dirección sin coordenadas',async()=>{
 for(const resolve of [async()=>({data:[]}),async()=>({data:[point,point]}),async()=>{throw Error('Proveedor no disponible');}]){const input=draft(),copy=structuredClone(input),r=await prepareAddress(input,resolve);assert.equal(r.values.address,'Calle 123');assert.equal(r.values.addressSelection,null);assert.match(r.addressNotice,/no verificada/);assert.deepEqual(input,copy);}
});
test('vacío incluso con fuente address no consulta y deja ubicación none',async()=>{const input=draft();input.values.address='   ';const r=await prepareAddress(input,()=>{throw Error('No consultar');});assert.equal(r.values.address,'');assert.equal(r.values.locationSource,'none');assert.equal(r.states.address,'omitted');});
test('sin comuna continúa sin consultar; radio requerido se degrada sin coordenadas',async()=>{const input=draft();input.values.commune='';input.modes={radiusKm:'required'};const r=await prepareAddress(input,()=>{throw Error('No consultar');});assert.equal(r.modes.radiusKm,'preferred');assert.ok(r.dirty.includes('radiusKm'));});
test('errores de autenticación no se ocultan',async()=>{await assert.rejects(prepareAddress(draft(),async()=>{throw Object.assign(Error('Sesión vencida'),{status:401});}),/Sesión vencida/);});
test('dirección confirmada sin editar no repite consulta',async()=>{const input=draft();input.dirty=[];input.values.addressSelection=point;assert.equal(await prepareAddress(input,()=>{throw Error('No consultar');}),input);});
