import sys,json,re,hashlib,collections
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[2]; OUT=Path(__file__).parent
sys.path.insert(0,str(ROOT/'Backend/scripts/etl'))
import google_maps_rich as rich
files=sorted(Path('C:/Users/david/Downloads').glob('dataset_crawler-google-places_2026-11-02_*.xlsx'))
groups={}; sources=[]
for f in files:
 w=openpyxl.load_workbook(f,read_only=True,data_only=True); rows=w['Data'].iter_rows(values_only=True); heads=next(rows)
 for n,vals in enumerate(rows,2):
  raw={str(k):v for k,v in zip(heads,vals) if k and v is not None}
  if not raw:continue
  src={'file':f.name,'row':n,'raw':raw};sources.append(src)
  # Only exact complete identity evidence is consolidated; unnamed rows stay distinct.
  identity=[raw.get(k) for k in ['title','address','location/lat','location/lng']]
  key=json.dumps(identity,ensure_ascii=False) if all(v is not None and v!='' for v in identity) else f.name+':'+str(n)
  groups.setdefault(key,[]).append(src)
records=[]; contacts=[]
for i,obs in enumerate(groups.values(),1):
 churches=[]; links={}; media={}; emails=set();phones=set();social=set();web=set()
 for o in obs:
  r,status,reason=rich.transform_rich(o['raw'],o['row'],o['file'],'consolidado-2026-11-02'); c=r['church'];churches.append(c)
  for x in c['externalProfile'].get('links',[]):links[x['url']]=x
  for x in c.get('media',[]):media[x['url']]=x
  emails.update(c['externalProfile'].get('emails',[]));phones.update(c['externalProfile'].get('phones',[]))
  for k,v in o['raw'].items():
   s=str(v).strip()
   if 'email' in k.lower():emails.update(re.findall(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}',s))
   if 'phone' in k.lower() and s:phones.add(rich.base.normalize_phone(s) or s)
   if rich.base.valid_url(s) and not any(t in k.lower() for t in ['image','picture','cover']):
    if any(t in s.lower() for t in ['facebook.com','instagram.com','youtube.com','youtu.be','tiktok.com','twitter.com','x.com/']):social.add(s)
    else:web.add(s)
  if o['raw'].get('domain'):web.add(str(o['raw']['domain']))
 c=churches[0];p=c.pop('externalProfile');c['media']=list(media.values()); c.pop('verification',None)
 if emails:c.setdefault('contact',{})['email']=sorted(emails)[0]
 name=obs[0]['raw'].get('title',''); blockers=['missing_google_place_id','missing_google_maps_url']+([] if name else ['missing_church_name'])
 if not name:c['identification'].pop('name',None)
 for kind in ['instagram','facebook','youtube']:
  candidates=sorted(u for u in social if kind+'.com' in u)
  if candidates:c.setdefault('contact',{})[kind]=candidates[0]
 entry={'schemaVersion':'koinonia.church-staging.v1','stagingId':f'NOV02-{i:04d}','importReady':False,'blockers':blockers,'church':c,'externalEvidence':{k:v for k,v in p.items() if k not in ['placeId','mapsUrl']},'contacts':{'emails':sorted(emails),'phones':sorted(phones),'socialNetworks':sorted(social),'websites':sorted(web)},'sourceObservations':obs,'linkedCommunityCandidates':[{'sourceFile':o['file'],'sourceRow':o['row'],'field':k,'value':v,'status':'association_unverified'} for o in obs for k,v in o['raw'].items() if re.match(r'(instagram|facebook|youtube)Profiles/\d+/(description|profileName|info/\d+)$',k)],'notes':['Social profiles are unverified associations, not confirmed linked communities.','Opening hours are not worship schedules.']}
 entry['externalEvidence']['links']=list(links.values());records.append(entry)
 contacts.append([name or '[Nombre ausente en origen]','\n'.join(sorted(emails)),'\n'.join(sorted(phones)),'\n'.join(sorted(social)),'\n'.join(sorted(web))])
def dump(name,obj): (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
(OUT/'iglesias.consolidado.staging.ndjson').write_text(''.join(json.dumps(r,ensure_ascii=False,default=str)+'\n' for r in records),encoding='utf-8')
dump('contacts.json',contacts)
report={'sourceRows':len(sources),'consolidatedRecords':len(records),'mergedExactRepeats':len(sources)-len(records),'missingNames':sum(not r['church']['identification'].get('name') for r in records),'importReady':0,'images':sum(len(r['church']['media']) for r in records),'withEmail':sum(bool(r['contacts']['emails']) for r in records),'withPhone':sum(bool(r['contacts']['phones']) for r in records),'files':[{'file':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files]}
dump('informe.json',report);print(json.dumps(report))
(OUT/'LEEME.txt').write_text('CONSOLIDADO PREVIO A IMPORTACION - NO IMPORTADO\n\nEstos archivos no contienen Place ID ni URL Maps. El primer Excel tampoco contiene title. No se inventaron identidades. El NDJSON es un formato staging, NO compatible directamente con import:churches. Se debe recuperar la identidad externa, resolver nombres y validar/clasificar antes de generar koinonia.church-import.v1.\n\nSolo se consolidan filas con nombre, direccion y coordenadas exactamente iguales. Otros posibles duplicados se conservan. No se consulto MongoDB. Todas las columnas originales se conservan en sourceObservations, incluidas descripciones y perfiles potencialmente relacionados. No se atribuyen comunidades vinculadas sin evidencia de pertenencia. La fecha del nombre del archivo no acredita hora de captura. Los contactos sociales necesitan comprobar asociacion. El Excel contiene todas las fichas, incluidas las sin nombre y las de clasificacion pendiente; una fila no certifica que sea una iglesia.\n',encoding='utf-8')
