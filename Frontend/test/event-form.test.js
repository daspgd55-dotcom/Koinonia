import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localInput,editEvent,eventPayload,pendingEvent} from '../src/eventForm.js';
test('Fechas locales fijas y conservación de segundos al editar otro campo',()=>{
 for(const month of ['01','07'])assert.equal(localInput(`2026-${month}-15T22:00:00.000Z`),`2026-${month}-15T19:00`);
 const e={title:'Evento',description:'Descripción',startsAt:'2099-01-01T02:00:30.000Z',endsAt:'2099-01-01T02:00:45.000Z',modality:'online',onlineUrl:'https://example.test'};
 const d=editEvent(e);assert.equal(d.startsAt,'2098-12-31T23:00');d.title='Otro nombre';const p=eventPayload(d,e);assert.equal(p.startsAt,e.startsAt);assert.equal(p.endsAt,e.endsAt);
 assert.ok(!pendingEvent(d,{active:true,metadata:{dataStatus:'published',firstPublishedByAdminAt:'2026-01-01'}},[],e).includes('Término posterior al inicio'));
 d.startsAt='2098-12-31T22:00';assert.equal(eventPayload(d,e).startsAt,d.startsAt);
});
test('Cambiar modalidad elimina datos incompatibles del envío sin perder el borrador',()=>{
 const d=editEvent({title:'Evento',modality:'online',location:{commune:'Santiago',address:'Dirección'},onlineUrl:'https://example.test'});assert.equal(eventPayload(d).location,null);assert.equal(d.location.commune,'Santiago');d.modality='in_person';assert.equal(eventPayload(d).onlineUrl,null);
});
