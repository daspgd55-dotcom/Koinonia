import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contrast} from '../src/comparison.js';
test('Contrasta conjuntos sin ranking ni diferencias por orden',()=>{
 assert.deepEqual(contrast(['Góspel · Himnos','Himnos · Góspel'],true).labels,['Coincidencia']);
 assert.deepEqual(contrast(['Góspel · Himnos','Góspel · Worship'],true),{labels:['Diferencias','Coincidencia parcial'],shared:['Góspel']});
 assert.deepEqual(contrast(['Santiago','Santiago','Sin información publicada']).labels,['Coincidencia entre datos disponibles','Información faltante']);
 assert.deepEqual(contrast(['Sin información publicada','Sin información publicada']).labels,['Información faltante']);
 assert.deepEqual(contrast(['Disponible','No disponible']).labels,['Diferencias']);
});
