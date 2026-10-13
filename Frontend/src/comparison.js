const normalize=v=>v.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function contrast(values,multiple=false){
 const known=values.filter(v=>v&&v!=='Sin información publicada'),missing=known.length<values.length,labels=[],shared=[];
 const sets=known.map(v=>[...new Set((multiple?v.split(' · '):[v]).map(normalize))].sort());
 if(known.length>=2){
  const same=sets.every(v=>JSON.stringify(v)===JSON.stringify(sets[0]));
  if(same)labels.push(missing?'Coincidencia entre datos disponibles':'Coincidencia');
  else{labels.push('Diferencias');if(multiple){for(const v of known[0].split(' · '))if(sets.every(s=>s.includes(normalize(v))))shared.push(v);if(shared.length)labels.push('Coincidencia parcial');}}
 }
 if(missing)labels.push('Información faltante');
 return {labels,shared};
}
