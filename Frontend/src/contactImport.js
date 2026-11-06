export const fields={name:'Nombre de iglesia',email:'Correo',phone:'Teléfono',website:'Página web',facebook:'Facebook',instagram:'Instagram',youtube:'YouTube',commune:'Comuna',address:'Dirección'};
const aliases={name:['nombre','nombre iglesia','nombre de iglesia','nombre de la iglesia','iglesia','name'],email:['correo','correo electronico','email','e-mail'],phone:['telefono','numero','phone','celular'],website:['web','pagina web','sitio web','website'],facebook:['facebook'],instagram:['instagram'],youtube:['youtube'],commune:['comuna','commune'],address:['direccion','address']};
const clean=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function guessColumns(headers){return Object.fromEntries(Object.keys(fields).map(k=>[k,headers.findIndex(h=>aliases[k].includes(clean(h)))]));}
export function parseTable(text,delimiter='\t'){
 const rows=[];let row=[],cell='',quoted=false;const input=text.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}else if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==delimiter){if(c==='\r'&&input[i+1]==='\n')i++;rows.push(row);row=[];}}else cell+=c;}
 if(quoted)throw Error('Hay una celda con comillas sin cerrar.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function mapRows(table,mapping){return table.slice(1).map((cells,i)=>({row:i+2,...Object.fromEntries(Object.keys(fields).map(k=>[k,String(cells[mapping[k]]||'').trim()]))})).filter(r=>Object.keys(fields).some(k=>r[k]));}
