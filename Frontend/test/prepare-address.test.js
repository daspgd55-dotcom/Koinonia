import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAddress} from '../src/prepareAddress.js';
const draft=(source='address')=>({values:{address:'Calle 123',commune:'Santiago',locationSource:source},states:{},dirty:['address']});
const point={address:'Calle 123',commune:'Santiago',lat:-33.45,lng:-70.65};
test('comprueba al guardar una dirección editada con cualquier fuente sin mutar respuestas',async()=>{
 for(const source of ['address','device','none']){const input=draft(source),copy=structuredClone(input);let calls=0;const result=await prepareAddress(input,async body=>{calls++;assert.deepEqual(body,{address:'Calle 123',commune:'Santiago'});return {data:[{...point,token:'signed'}]};});assert.equal(calls,1);assert.equal(result.values.addressSelection.token,'signed');assert.ok(result.dirty.includes('addressSelection'));assert.deepEqual(input,copy);}
});
test('ausencia, ambigüedad y fallo del proveedor conservan el borrador',async()=>{
 for(const data of [[],[point,point]]){const input=draft(),copy=structuredClone(input);await assert.rejects(prepareAddress(input,async()=>({data})));assert.deepEqual(input,copy);}
 await assert.rejects(prepareAddress(draft(),async()=>{throw Error('Proveedor no disponible');}),/Proveedor no disponible/);
});
test('no repite consultas para dirección confirmada ni para edición ajena a dirección histórica',async()=>{
 const fail=async()=>{throw Error('Consulta inesperada');};const input=draft();input.dirty=[];input.values.addressSelection=point;assert.equal(await prepareAddress(input,fail),input);
 const old=draft('device');old.dirty=['goal'];assert.equal(await prepareAddress(old,fail),old);
});
test('dirección opcional vacía, comuna obligatoria para comprobar y selección sin confirmar',async()=>{
 const input=draft('none');input.values.address='';assert.equal(await prepareAddress(input,async()=>{throw Error('Consulta inesperada');}),input);
 input.values.locationSource='address';await assert.rejects(prepareAddress(input,async()=>{}),/Indica una dirección/);
 const missing=draft();missing.values.commune='';await assert.rejects(prepareAddress(missing,async()=>{}),/Indica la comuna/);
 const unconfirmed=draft();unconfirmed.dirty=['locationSource'];const result=await prepareAddress(unconfirmed,async()=>({data:[{...point,token:'fresh'}]}));assert.equal(result.values.addressSelection.token,'fresh');
});
