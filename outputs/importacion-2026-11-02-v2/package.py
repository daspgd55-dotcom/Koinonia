import json,csv,zipfile
from pathlib import Path
import openpyxl
p=Path(__file__).parent
load=lambda n:[json.loads(s) for s in (p/n).read_text(encoding='utf-8').splitlines()]
ready=load('churches.import.ndjson');assert len({r['externalKey'] for r in ready})==len(ready)==375
allrows=load('consolidado-completo.ndjson');assert sum(len(r['sourceObservations']) for r in allrows)==508
for filename in ['consolidado-completo.ndjson','revision.ndjson']:
 rows=load(filename)
 for r in rows:
  if 'originalStagingChurch' not in r:r['originalStagingChurch']=r.pop('church')
  r['church']=r['preparedRecord']['church']
  r['importReady']=r['classification']['status']=='accepted';r['blockers']=[] if r['importReady'] else [r['classification']['reason']]
 (p/filename).write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows),encoding='utf-8')
with (p/'revision-resumen.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['ID','Nombre','Direccion','Motivo','Candidatos Maps'])
 for r in load('revision.ndjson'):w.writerow([r['stagingId'],r['church']['identification'].get('name'),r['church']['location']['address'],r['classification']['reason'],json.dumps(r['matchCandidates'],ensure_ascii=False)])
assert sum(1 for _ in openpyxl.load_workbook(p/'contactos-iglesias.xlsx',read_only=True).active.values)==508
(p/'LEEME.txt').write_text('PREPARACION V2 - SIN IMPORTAR\n\nchurches.import.ndjson: 375 identidades Google unicas, validadas por el importador local, sin conexion a MongoDB. Corresponden a 377 fichas previas; dos identidades repetidas se unieron. No se ha conciliado contra la base existente: usar plan merge antes de aplicar.\nconsolidado-completo.ndjson: 507 fichas originales con evidencia, nombres recuperados y asociaciones auditables. sourceObservations conserva 508 filas originales; mapsObservation conserva la fila adicional asignada.\nrevision.ndjson y revision-resumen.csv: 130 fichas pendientes: 18 por asociacion Maps ambigua, 11 por comuna ausente/ambigua y 101 por clasificacion conservadora. No significan iglesias invalidas.\nmaps-sin-asociar.ndjson: 53 filas adicionales sin correspondencia unica; conservadas sin inventar coordenadas ni contactos.\n\nMetodo: comparar dentro del lote de origen direccion normalizada, calle, titulo, postal, web y nombres de perfiles. Nunca asignar por posicion. Las nuevas hojas no contienen coordenadas para desempatar. Se recuperaron 225 nombres desde titulos Maps; las 15 fichas aun sin nombre tampoco poseen profileName util. No se infirieron nombres adicionales. No se mezclan iglesias por compartir direccion ni se elige arbitrariamente entre Place ID distintos.\n\nSe conservan imagenes y perfiles adicionales; las comunidades vinculadas requieren confirmar asociacion. El contrato limita medios a 30 por ficha: evidencia completa permanece en el consolidado. Los horarios de apertura no se convierten en cultos. Los datos externos no acreditan autorizacion institucional. La fecha del archivo se mantiene como provisional.\n\nExcel: mantiene las 507 fichas para trazabilidad, incluidos pendientes y repeticiones que el lote importable une por identidad. Solo cinco columnas solicitadas; contactos de perfiles externos requieren verificar pertenencia.\n',encoding='utf-8')
with zipfile.ZipFile(p/'consolidado-iglesias-v2.zip','w',zipfile.ZIP_DEFLATED) as z:
 for n in ['churches.import.ndjson','consolidado-completo.ndjson','revision.ndjson','revision-resumen.csv','maps-sin-asociar.ndjson','informe.json','LEEME.txt']:z.write(p/n,n)
print('Paquete y conteos verificados')
