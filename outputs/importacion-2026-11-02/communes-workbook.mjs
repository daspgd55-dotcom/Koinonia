import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const dir=new URL('../importacion-comunas-2026-11-05/',import.meta.url),{info,rows}=JSON.parse(await fs.readFile(new URL('data.json',dir),'utf8'));
const w=Workbook.create(),s=w.worksheets.add('Contactos');s.showGridLines=false;
const headers=['Iglesia','Correos','Sitios web','Facebook','Instagram','YouTube','Otras redes','Teléfonos','Dirección','Comuna','URL de Maps','Estado','Activa','Origen del enlace Maps','ID de iglesia','Privacidad configurada'];
s.mergeCells('A1:P1');s.getRange('A1').values=[['Koinonía · Contactos anteriores y nuevas fichas aprobadas']];s.getRange('A1:P1').format={fill:'#176B65',font:{name:'Arial',size:17,bold:true,color:'#FFFFFF'},rowHeight:36};
s.mergeCells('A2:P2');s.getRange('A2').values=[[`Fuente: MongoDB ${info.database} · Extracción: ${info.extractedAt} · ${info.total} iglesias · ${info.withEmails} con correo · ${info.withWebsites} con web · ${info.withSocial} con redes · ${info.withPhones} con teléfono`]];
s.mergeCells('A3:P3');s.getRange('A3').values=[['Incluye borradores y todos los estados. Celdas vacías = dato no registrado. Los contactos externos pueden estar pendientes de validación institucional.']];
s.mergeCells('A4:P4');s.getRange('A4').values=[['Orden alfabético. Use los filtros para localizar contactos. Maps generado desde coordenadas se identifica en su columna; no equivale a un Place ID verificado.']];
s.getRange('A2:P4').format={font:{name:'Arial',size:10,color:'#455A64'},rowHeight:23};
s.getRange(`A5:P${rows.length+5}`).values=[headers,...rows.map(r=>r.map(v=>typeof v==='string'&&v.startsWith('=')?"'"+v:v))];
const range=s.getRange(`A5:P${rows.length+5}`);range.format.font={name:'Arial',size:10};range.format.wrapText=true;range.format.verticalAlignment='top';range.setNumberFormat('@');
const widths=[43,37,50,48,45,48,42,24,50,23,55,18,10,30,29,28];for(let i=0;i<16;i++)s.getRange(`${String.fromCharCode(65+i)}:${String.fromCharCode(65+i)}`).format.columnWidth=widths[i];
s.tables.add(`A5:P${rows.length+5}`,true,'DirectorioPilot');s.getRange('A5:P5').format={fill:'#176B65',font:{bold:true,color:'#FFFFFF'},rowHeight:30};
for(let i=0;i<rows.length;i++){const lines=Math.max(...rows[i].map((v,j)=>String(v).split('\n').reduce((n,l)=>n+Math.max(1,Math.ceil(l.length/(widths[j]*0.9))),0)));s.getRange(`A${i+6}:P${i+6}`).format.rowHeight=Math.min(409,Math.max(38,lines*14+8));}
s.freezePanes.freezeRows(5);w.recalculate();
const out=await SpreadsheetFile.exportXlsx(w);await out.save(new URL('contactos-iglesias.xlsx',dir).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
for(const [name,range]of [['contactos','A5:F10'],['ubicacion','H5:N10']]){const blob=await w.render({sheetName:'Contactos',range,scale:1});await fs.writeFile(new URL(name+'.png',dir),new Uint8Array(await blob.arrayBuffer()));}
console.log('Exportadas '+rows.length+' iglesias');

