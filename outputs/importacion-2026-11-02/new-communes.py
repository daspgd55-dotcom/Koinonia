import json,sys,re,collections,hashlib
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/importacion-comunas-2026-11-05';OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT/'Backend/scripts/etl'));import google_maps_rich as etl
names=['La Pintana','San Bernardo','Las Condes','Maipu','Peñalolen','Estacion Central'];seen={};audit=[];changes=[]
for name in names:
 f=Path('C:/Users/david/Downloads')/(name+'.xlsx');w=openpyxl.load_workbook(f,read_only=True,data_only=True);it=w.active.iter_rows(values_only=True);headers=next(it)
 for n,values in enumerate(it,2):
  raw={k:v for k,v in zip(headers,values) if k and v is not None}
  if not raw:continue
  adapted=dict(raw);adapted['scrapedAt']='2026-11-05T00:00:00.000Z'
  r,status,reason=etl.transform_rich(adapted,n,f.name,'comunas-2026-11-05');c=r['church'];p=c['externalProfile'];p.pop('capturedAtBasis',None);r['provenance']['issues'].append('capture_date_unknown_preparation_date_placeholder')
  title=etl.base.fold(c['identification']['name']);religious=bool(re.search(r'\b(iglesia|parroquia|capilla|congregacion|templo|ministerio|santuario|basilica|catedral)\b',title));excluded=bool(re.search(r'\b(basural|fundacion|seminario|colegio|escuela|universidad|instituto|cementerio|empresa|limitada|paradero|oficina administrativa)\b',title))
  if status!='rejected' and religious and not excluded:status,reason='accepted','community_evidence_in_title'
  if excluded:status,reason='review','entity_not_confirmed_local_church'
  if religious and not excluded:
   for token,denom in [('metodista pentecostal','Metodista Pentecostal'),('presbiterian','Presbiteriana'),('bautista','Bautista'),('adventista','Adventista'),('asamblea de dios','Asambleas de Dios'),('anglican','Anglicana'),('luteran','Luterana'),('catolic','Católica'),('pentecostal','Pentecostal')]:
    if token in title:c['christianIdentity']={'denomination':denom};changes.append({'key':r['externalKey'],'field':'christianIdentity.denomination','value':denom,'evidence':c['identification']['name']});r['provenance']['issues'].append('denomination_inferred_from_name_pending_review');break
  for field,source in [('email','emails'),('phone','phones')]:
   if len(p.get(source,[]))==1:c.setdefault('contact',{}).setdefault(field,p[source][0])
  for network,field in [('facebooks/0','facebook'),('instagrams/0','instagram'),('youtubes/0','youtube')]:
   if etl.base.valid_url(raw.get(network)):c.setdefault('contact',{})[field]=raw[network]
  item={'file':f.name,'row':n,'status':status,'reason':reason,'record':r,'original':raw};audit.append(item)
  if status=='accepted':
   if r['externalKey'] in seen:
    target=seen[r['externalKey']]['church'];item['status']='duplicate'
    for k in ['links','phones','emails','categories']:target['externalProfile'][k]=list({json.dumps(v,sort_keys=True):v for v in target['externalProfile'].get(k,[])+p.get(k,[])}.values())
    target['media']=list({v['url']:v for v in target.get('media',[])+c.get('media',[])}.values())[:30]
   else:seen[r['externalKey']]=r
def nd(n,rs):(OUT/n).write_text(''.join(json.dumps(x,ensure_ascii=False,default=str)+'\n' for x in rs),encoding='utf-8')
nd('churches.import.ndjson',seen.values());nd('evidencia-completa.ndjson',audit);nd('revision.ndjson',[x for x in audit if x['status'] not in ['accepted','duplicate']]);nd('inferencias.ndjson',changes)
base=json.loads((ROOT/'outputs/contactos-pilot-2026-11-02/data.json').read_text(encoding='utf-8'));rows=base['rows'];known={r[10].split('query_place_id=')[-1].split('&')[0] for r in rows if 'query_place_id=' in r[10]};added=0
for r in seen.values():
 c=r['church'];p=c['externalProfile'];ct=c.get('contact',{})
 if p['placeId'] in known:continue
 rows.append([c['identification']['name'],'\n'.join(p.get('emails',[])),ct.get('website',''),ct.get('facebook',''),ct.get('instagram',''),ct.get('youtube',''),'','\n'.join(p.get('phones',[])),c['location'].get('address',''),c['location'].get('commune',''),p['mapsUrl'],'Pendiente de importar','','Archivo Excel',r['externalKey'],'']);known.add(p['placeId']);added+=1
rows.sort(key=lambda r:r[0].casefold());base['rows']=rows;base['info'].update(total=len(rows),database='Snapshot Pilot 02-11 + aprobadas 05-11 (sin importar)',extractedAt='2026-11-05',withEmails=sum(bool(r[1]) for r in rows),withWebsites=sum(bool(r[2]) for r in rows),withSocial=sum(any(r[3:7]) for r in rows),withPhones=sum(bool(r[7]) for r in rows));(OUT/'data.json').write_text(json.dumps(base,ensure_ascii=False),encoding='utf-8')
report={'input':len(audit),'approvedUnique':len(seen),'dispositions':dict(collections.Counter(x['status'] for x in audit)),'inferredDenominations':len(changes),'newContactRows':added,'contactsTotal':len(rows)};(OUT/'informe.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(report)
