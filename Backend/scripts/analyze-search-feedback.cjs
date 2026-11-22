const {fs,path,root,sha,read,exportSchema,canonical}=require('./search-diagnostics.cjs');
async function main(){
 const [file,...rest]=process.argv.slice(2);if(!file||rest.length)throw Error('USE_EXPORT_JSON_PATH');const input=exportSchema.parse(await read(file));
 // Un mismo registro exportado repetido no debe multiplicar valoraciones.
 const latest=new Map();for(const r of input.records){const old=latest.get(r.key);if(!old||r.updatedAt>old.updatedAt)latest.set(r.key,r);}const records=[...latest.values()],groups=new Map();
 for(const r of records){if(!groups.has(r.query))groups.set(r.query,[]);groups.get(r.query).push(r);}
 const sourceHash=sha(JSON.stringify(input)),directory=path.join(root,'outputs/search-diagnostics',sourceHash.slice(0,12));await fs.mkdir(directory,{recursive:true});
 const cases=[],diagnoses=[];
 for(const [query,rows] of groups){const id=sha(query).slice(0,16),signals=[];
  for(const r of rows){const status=r.result?.validation.status,negative=['insufficient','irrelevant'].includes(r.rating);
   if(r.intent.needsClarification)signals.push({category:'interpretation',certainty:'observed',record:r.key,detail:'La interpretación registrada pidió aclaración.'});
   if(status==='unknown')signals.push({category:'missing_information',certainty:'observed',record:r.key,detail:'El validador registrado carecía de evidencia suficiente.'});
   if(status==='not_satisfied')signals.push({category:'requirements',certainty:'observed',record:r.key,detail:'La ficha registrada contradijo un requisito; no demuestra un fallo del filtro.'});
   if(negative&&r.kind==='result')signals.push({category:'retrieval',certainty:'hypothesis',record:r.key,detail:'Resultado valorado como insuficiente/no pertinente; revisar fragmento, interpretación y cobertura antes de atribuir causa.'});
   if(negative&&r.kind==='interpretation')signals.push({category:'interpretation',certainty:'hypothesis',record:r.key,detail:'El usuario valoró negativamente la interpretación; falta expectativa confirmada.'});
   if(r.comment)signals.push({category:'manual_review',certainty:'user_comment',record:r.key,detail:r.comment});
  }
  const judgments=rows.map(r=>({mode:r.mode,kind:r.kind,churchId:r.result?.churchId||null,field:r.result?.field||null,rating:r.rating,comment:r.comment,fragment:r.result?.fragment||null,score:r.result?.score??null}));
  const baselines=[...new Map(rows.map(r=>{const value=canonical(r.intent);return [JSON.stringify(value),value];})).values()];
  cases.push({id,query,expectation:{status:'pending_review',value:null},recordedInterpretations:baselines,judgments});
  diagnoses.push({id,query,ratings:{useful:rows.filter(r=>r.rating==='useful').length,insufficient:rows.filter(r=>r.rating==='insufficient').length,irrelevant:rows.filter(r=>r.rating==='irrelevant').length,unrated:rows.filter(r=>!r.rating).length},priority:rows.filter(r=>['insufficient','irrelevant'].includes(r.rating)).length,signals});
 }
 diagnoses.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
 const summary={createdAt:new Date().toISOString(),sourceHash,records:records.length,queries:cases.length,negativeRatings:records.filter(r=>['insufficient','irrelevant'].includes(r.rating)).length,limitations:['Las valoraciones no definen automáticamente resultados esperados.','No se infieren errores de presentación desde el texto de los comentarios.','No se calcula precisión: faltan juicios de todos los candidatos y expectativas revisadas.']};
 await fs.writeFile(path.join(directory,'analysis.json'),JSON.stringify({...summary,diagnoses},null,2)+'\n');
 try{await fs.writeFile(path.join(directory,'cases.json'),JSON.stringify({schema:'koinonia-search-replay-v1',sourceHash,cases},null,2)+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 await fs.writeFile(path.join(directory,'analysis.md'),'# Diagnóstico de evaluaciones\n\n'+`${summary.records} registros; ${summary.queries} consultas; ${summary.negativeRatings} valoraciones insuficientes/no pertinentes. Las causas propuestas son hipótesis, no conclusiones.\n\n`+diagnoses.map(d=>'## '+d.query+'\n\n'+JSON.stringify(d.ratings)+'\n\n'+(d.signals.length?d.signals.map(s=>'- '+s.category+' ['+s.certainty+']: '+s.detail.replace(/\n/g,' ')).join('\n'):'Sin señales de problema en los registros aportados.')).join('\n\n'));
 console.log(JSON.stringify({...summary,directory}));
}
main().catch(e=>{console.error(e instanceof require('zod').ZodError?'INVALID_FEEDBACK_SCHEMA':e.code||e.message);process.exitCode=1;});
