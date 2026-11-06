import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTable,guessColumns,mapRows} from '../src/contactImport.js';
test('Excel pegado conserva filas y celdas multilínea; reconoce encabezados y permite varios correos',()=>{
 const t=parseTable('Nombre de iglesia\tCorreo\tTeléfono\r\n"Iglesia\nCentro"\t"a@example.org; b@example.org"\t912345678\r\n\t\t\r\nOtra\tc@example.org\t');
 const rows=mapRows(t,guessColumns(t[0]));assert.equal(rows.length,2);assert.equal(rows[0].name,'Iglesia\nCentro');assert.equal(rows[0].email,'a@example.org; b@example.org');assert.equal(rows[1].row,4);assert.equal(rows[0].phone,'912345678');
});
test('CSV BOM y comillas escapadas',()=>{const t=parseTable('\uFEFFNombre,Correo\n"Iglesia ""Centro""",a@example.org',',');assert.equal(t[1][0],'Iglesia "Centro"');assert.throws(()=>parseTable('Nombre\n"Sin cierre'));});
