import json,sys,re,csv,collections,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/importacion-comunas-2026-11-13';OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT/'Backend/scripts/etl'));import google_maps_rich as etl
import openpyxl
seen={};audit=[];changes=[]
for commune in ['San Miguel','La Reina','La Granja']:
 f=Path('C:/Users/david/Downloads')/(commune+'.xlsx');w=openpyxl.load_workbook(f,read_only=True,data_only=True);it=w.active.iter_rows(values_only=True);headers=next(it)
 for n,vals in enumerate(it,2):
  raw={k:v for k,v in zip(headers,vals) if k and v is not None}
  if not raw:continue
  a=dict(raw);a['scrapedAt']='2026-11-13T00:00:00.000Z';a.setdefault('state','Región Metropolitana')
  urls={k:etl.base.valid_url(v) for k,v in raw.items() if k=='website' or re.match(r'(facebooks|instagrams|youtubes)/\d+$',k)};urls={k:v for k,v in urls.items() if v}
  if not a.get('title'):
   a['title']=next((str(v) for k,v in raw.items() if k.endswith('/profileName') and v),f'Comunidad por identificar — {commune} — fila {n}')
   changes.append({'file':f.name,'row':n,'field':'identification.name','value':a['title'],'basis':'profile_name_or_explicit_placeholder'})
  if not etl.base.commune_from(a):
   a['city']=commune;a['address']=a.get('address') or 'Dirección pendiente de revisión'
   # Source area is an explicit provisional inference, not geocoding.
   changes.append({'file':f.name,'row':n,'field':'location.commune','value':commune,'basis':'source_filename_unverified'})
  r,status,reason=etl.transform_rich(a,n,f.name,'comunas-2026-11-13');c=r['church'];p=c['externalProfile'];p.pop('capturedAtBasis',None);r['provenance']['issues'].append('capture_date_unknown_preparation_date_placeholder')
  if not c['location'].get('commune'):
   c['location']['commune']=commune;r['provenance']['issues'].append('commune_inferred_from_filename_pending_review');reason=';'.join(x for x in reason.split(';') if x!='missing_or_ambiguous_commune');status='review' if not reason else status
  name=etl.base.fold(a['title']);religious=bool(re.search(r'\b(iglesia|capilla|parroquia|congregacion|ministerio|templo|santuario|catedral)\b',name))
  denom=None
  for token,value in [('metodista pentecostal','Metodista Pentecostal'),('bautista','Bautista'),('presbiterian','Presbiteriana'),('adventista','Adventista'),('pentecostal','Pentecostal'),('catolic','Católica'),('anglican','Anglicana'),('luteran','Luterana')]:
   if religious and token in name:denom=value;break
  c['christianIdentity']={'denomination':denom or 'Por confirmar'};r['provenance']['issues'].append('denomination_inferred_pending_review' if denom else 'denomination_unknown_explicit_placeholder')
  changes.append({'file':f.name,'row':n,'field':'christianIdentity.denomination','value':denom or 'Por confirmar','basis':'name' if denom else 'explicit_unknown_placeholder'})
  ct=c.setdefault('contact',{})
  for field,prefix in [('facebook','facebooks/'),('instagram','instagrams/'),('youtube','youtubes/')]:
   v=next((v for k,v in urls.items() if k.startswith(prefix)),None)
   if v:ct[field]=v
  if p.get('emails'):ct['email']=p['emails'][0]
  if status!='rejected' and (religious or urls):status='accepted';reason='supplied_name_or_online_presence_pending_review';r['provenance']['issues'].append(reason)
  item={'file':f.name,'row':n,'status':status,'reason':reason,'record':r,'original':raw};audit.append(item)
  if status=='accepted':
   key=r['externalKey']
   if key in seen:
    item['status']='duplicate';t=seen[key]['church']
    for field in ['links','emails','phones','categories']:t['externalProfile'][field]=list({json.dumps(v,sort_keys=True):v for v in t['externalProfile'].get(field,[])+p.get(field,[])}.values())
    t['media']=list({v['url']:v for v in t.get('media',[])+c.get('media',[])}.values())[:30]
    for k,v in ct.items():t.setdefault('contact',{}).setdefault(k,v)
   else:seen[key]=r
def nd(n,rs):(OUT/n).write_text(''.join(json.dumps(x,ensure_ascii=False,default=str)+'\n' for x in rs),encoding='utf-8')
nd('churches.import.ndjson',seen.values());nd('evidencia.ndjson',audit);nd('revision.ndjson',[x for x in audit if x['status'] not in ['accepted','duplicate']]);nd('inferencias.ndjson',changes)
rows=[]
for r in seen.values():
 c=r['church'];p=c['externalProfile'];ct=c.get('contact',{});links=p.get('links',[])
 vals=[c['identification']['name'],'\n'.join(p.get('emails',[])),ct.get('website','')]
 for network in ['facebook','instagram','youtube']:vals.append('\n'.join(dict.fromkeys([v for v in [ct.get(network)]+[x['url'] for x in links if re.search(r'https?://(?:[\w-]+\.)?'+network+r'\.com/',x['url'])] if v])))
 vals+=['\n'.join(dict.fromkeys([v for v in [ct.get('phone')]+p.get('phones',[]) if v])),c['location'].get('address',''),c['location']['commune']]
 if any(vals[1:6]):rows.append(vals)
rows.sort(key=lambda r:r[0].casefold())
with (OUT/'contactos-iglesias.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.writer(f);writer.writerow(['Iglesia','Correo','Pagina web','Facebook','Instagram','Youtube','Telefono','Direccion','Comuna']);writer.writerows(rows)
report={'inputRows':len(audit),'importable':len(seen),'contacts':len(rows),'dispositions':dict(collections.Counter(x['status'] for x in audit))};(OUT/'informe.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(report)
