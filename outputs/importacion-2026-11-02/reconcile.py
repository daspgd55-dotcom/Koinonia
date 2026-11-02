import json,re,sys,collections,unicodedata,copy
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
import openpyxl
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/importacion-2026-11-02-v2';OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT/'Backend/scripts/etl'));import google_maps_rich as rich
old=[json.loads(x) for x in (Path(__file__).parent/'iglesias.consolidado.staging.ndjson').read_text(encoding='utf-8').splitlines()]
fold=lambda x:re.sub(r'[^a-z0-9]+',' ',''.join(c for c in unicodedata.normalize('NFD',str(x or '').lower()) if not unicodedata.combining(c))).strip()
new=[]
for f in sorted(Path('C:/Users/david/Downloads').glob('dataset_crawler-google-places_2026-11-02_*(*).xlsx')):
 w=openpyxl.load_workbook(f,read_only=True,data_only=True);it=w.active.iter_rows(values_only=True);h=next(it)
 for n,v in enumerate(it,2):
  raw={k:x for k,x in zip(h,v) if k and x is not None}
  if raw:new.append({'file':f.name,'row':n,'raw':raw,'originalFile':re.sub(r' \(\d+\)(?=\.xlsx)','',f.name)})
matches=[];used=set()
for e in old:
 candidates=[]
 for j,n in enumerate(new):
  scores=[]
  for o in e['sourceObservations']:
   if o['file']!=n['originalFile']:continue
   a,b=o['raw'],n['raw'];addr=bool(fold(a.get('address'))) and fold(a.get('address'))==fold(b.get('address'));title=bool(fold(a.get('title'))) and fold(a.get('title'))==fold(b.get('title'));street=bool(fold(a.get('street'))) and fold(a.get('street'))==fold(b.get('street'));postal=bool(a.get('postalCode')) and str(a.get('postalCode'))==str(b.get('postalCode'))
   website=bool(a.get('website')) and str(a.get('website')).rstrip('/')==str(b.get('website')).rstrip('/')
   profiles=[fold(v) for k,v in a.items() if k.endswith('/profileName')]
   profile=bool(fold(b.get('title'))) and any(fold(b.get('title'))==p for p in profiles)
   score=(100 if addr else 0)+(50 if title else 0)+(20 if street else 0)+(10 if postal else 0)+(80 if website else 0)+(60 if profile else 0)
   if addr or (title and street):scores.append(score)
  if scores:candidates.append((max(scores),j))
 candidates.sort(reverse=True)
 chosen=candidates[0][1] if candidates and (len(candidates)==1 or candidates[0][0]>candidates[1][0]) else None
 matches.append((e,chosen,candidates))
counts=collections.Counter(j for _,j,_ in matches if j is not None);ready={};review=[];audit=[];contacts=[]
for e,j,candidates in matches:
 raw=copy.deepcopy(e['sourceObservations'][0]['raw']);nameOrigin='original_title';e['matchCandidates']=[{'file':new[k]['file'],'row':new[k]['row'],'score':s} for s,k in candidates]
 if j is not None and counts[j]==1:
  n=new[j];used.add(j)
  for k,v in n['raw'].items():
   if v is not None and str(v).strip():raw[k]=v
  e['mapsObservation']=n;nameOrigin='matched_maps_title'
 if not raw.get('title'):
  names=list(dict.fromkeys(str(v).strip() for o in e['sourceObservations'] for k,v in o['raw'].items() if k.endswith('/profileName') and str(v).strip()))
  churchNames=[n for n in names if re.search(r'\b(iglesia|parroquia|capilla|ministerio|comunidad|templo|church|congregacion)\b',fold(n))]
  e['nameCandidates']=names
  if len(set(map(fold,churchNames)))==1:raw['title']=churchNames[0];nameOrigin='social_profile_inferred'
 source=e['sourceObservations'][0];r,status,reason=rich.transform_rich(raw,source['row'],source['file'],'consolidado-2026-11-02-v2')
 if nameOrigin=='social_profile_inferred':r['provenance']['issues'].append('church_name_inferred_from_social_profile');status='review';reason='name_association_requires_review'
 # Preserve all prior media/contact evidence without arbitrarily promoting profile contacts.
 r['church']['media']=e['church'].get('media',[])[:30]
 for k in ['links','phones','emails']:
  vals=e['externalEvidence'].get(k,[])+r['church']['externalProfile'].get(k,[])
  r['church']['externalProfile'][k]=list({json.dumps(v,sort_keys=True):v for v in vals}.values())
 e['preparedRecord']=r;e['classification']={'status':status,'reason':reason};e['nameOrigin']=nameOrigin
 previousTitle=source['raw'].get('title')
 if previousTitle and fold(previousTitle)!=fold(raw.get('title')):e['classification']={'status':'review','reason':'conflicting_titles_requires_review'}
 if j is None or counts.get(j,0)!=1:e['classification']={'status':'review','reason':'missing_or_ambiguous_maps_match'}
 if e['classification']['status']=='accepted':
  key=r['externalKey']
  if key in ready:
   for k in ['links','phones','emails']:
    p=ready[key]['church']['externalProfile'];p[k]=list({json.dumps(v,sort_keys=True):v for v in p.get(k,[])+r['church']['externalProfile'].get(k,[])}.values())
   ready[key]['church']['media']=list({m['url']:m for m in ready[key]['church'].get('media',[])+r['church']['media']}.values())[:30]
  else:ready[key]=r
 else:review.append(e)
 audit.append(e)
 websites=set(e['contacts']['websites'])
 if raw.get('website'):websites.add(raw['website'])
 contacts.append([raw.get('title') or '[Nombre pendiente]','\n'.join(e['contacts']['emails']),'\n'.join(e['contacts']['phones']),'\n'.join(e['contacts']['socialNetworks']),'\n'.join(sorted(websites))])
def nd(name,rows):(OUT/name).write_text(''.join(json.dumps(r,ensure_ascii=False,default=str)+'\n' for r in rows),encoding='utf-8')
nd('churches.import.ndjson',ready.values());nd('revision.ndjson',review);nd('consolidado-completo.ndjson',audit);nd('maps-sin-asociar.ndjson',[n for j,n in enumerate(new) if j not in used])
(OUT/'contacts.json').write_text(json.dumps(contacts,ensure_ascii=False),encoding='utf-8')
report={'originalRecords':len(old),'newMapsRows':len(new),'matched':len(used),'unmatchedOriginal':len(old)-len(used),'unmatchedMaps':len(new)-len(used),'importCandidates':len(ready),'review':len(review),'missingNames':sum(not a['preparedRecord']['church']['identification']['name'] for a in audit),'namesFromSocial':sum(a['nameOrigin']=='social_profile_inferred' for a in audit),'classifications':dict(collections.Counter(a['classification']['reason'] for a in audit))}
(OUT/'informe.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report))
