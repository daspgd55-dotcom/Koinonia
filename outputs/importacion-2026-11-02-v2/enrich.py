import json,re,copy,collections,csv,zipfile,unicodedata
from pathlib import Path
SRC=Path(__file__).parent;OUT=SRC.parent/'importacion-2026-11-02-v3';OUT.mkdir(exist_ok=True)
read=lambda n:[json.loads(s) for s in (SRC/n).read_text(encoding='utf-8').splitlines()]
fold=lambda v:''.join(c for c in unicodedata.normalize('NFD',str(v).lower()) if not unicodedata.combining(c))
allrows=read('consolidado-completo.ndjson');pending=read('revision.ndjson');batch=read('churches.import.ndjson');changes=[];added=[];remaining=[];audit=[]
postal=collections.defaultdict(collections.Counter)
for e in allrows:
 l=e['church']['location'];p=l.get('postalCode');c=l.get('commune')
 if p and c:postal[p[:3]][c]+=1
for e in pending:
 r=copy.deepcopy(e['preparedRecord']);c=r['church'];evidence=[('title',c['identification'].get('name',''))]
 for o in e['sourceObservations']:
  evidence += [(o['file']+':'+str(o['row'])+':'+k,str(v)) for k,v in o['raw'].items() if any(t in k for t in ['profileName','description','website','domain','categoryName','categories/','profileURL'])]
 def setfield(path,value,source,confidence='inferred'):
  obj=c;parts=path.split('.')
  for k in parts[:-1]:obj=obj.setdefault(k,{})
  if obj.get(parts[-1]) not in [None,'',[]]:return
  obj[parts[-1]]=value;changes.append({'id':e['stagingId'],'field':path,'value':value,'evidence':source,'status':confidence});r['provenance']['issues'].append('inferred_pending_representative_review:'+path)
 l=c['location'];name=c['identification'].get('name','');title=fold(name)
 if not l.get('commune') and l.get('postalCode'):
  dist=postal[l['postalCode'][:3]]
  if len(dist)==1 and sum(dist.values())>=3:
   commune=next(iter(dist))
   if fold(commune) in fold(l.get('address','')):
    setfield('location.commune',commune,{'postalPrefix':l['postalCode'][:3],'supportingRows':sum(dist.values()),'address':l['address']})
 # Explicit words only; do not infer a denomination from personal surnames or generic Christian terms.
 religious=bool(re.search(r'\b(iglesia|congregacion|ministerio|parroquia|capilla|santuario|local|movimiento misionero)\b',title))
 noncommunity=bool(re.search(r'\b(basural|fundacion|seminario|instituto|noviciado|paradero|soluciones|sociedad|limitada)\b',title))
 rules=[('presbiterian','Presbiteriana'),('bautista','Bautista'),('metodista pentecostal','Metodista Pentecostal'),('asamblea de dios','Asambleas de Dios'),('adventista','Adventista'),('anglican','Anglicana'),('luteran','Luterana'),('catolic','Católica'),('pentecostal','Pentecostal')]
 if religious and not noncommunity:
  for token,value in rules:
   hits=[(k,v) for k,v in evidence if token in fold(v)]
   if hits:setfield('christianIdentity.denomination',value,hits[0]);break
  for k,v in evidence:
   if 'evangelic' in fold(v):setfield('christianIdentity.branch','Evangélica',(k,v));break
 # Unique supplied profile links/contact values are direct extractions, not invented contacts.
 contact=c.setdefault('contact',{});p=c['externalProfile']
 for key,values in [('email',p.get('emails',[])),('phone',p.get('phones',[]))]:
  if len(values)==1:setfield('contact.'+key,values[0],{'externalProfileField':key,'value':values[0]},'extracted_unverified_association')
 for network in ['facebook','instagram','youtube']:
  urls=list(dict.fromkeys(x['url'] for x in p.get('links',[]) if re.search(r'https?://(?:[\w-]+\.)?'+network+r'\.com/',x['url']) and not any(t in x.get('kind','').lower() for t in ['image','picture'])))
  if len(urls)==1:setfield('contact.'+network,urls[0],{'externalProfile.links':urls[0]},'extracted_unverified_association')
 strong= religious and not noncommunity
 # Additional explicit evidence in a supplied profile or domain can confirm a church label.
 if not noncommunity and any('iglesia' in fold(v) or 'church' in fold(v) for k,v in evidence if k!='title' and not any(t in k for t in ['categoryName','categories/'])):strong=True
 if title.startswith('movimiento misionero mundial'):strong=True
 reason=e['classification']['reason']
 allowed=reason!='missing_or_ambiguous_maps_match' and bool(l.get('commune')) and strong and bool(name)
 r['provenance']['issues']=list(dict.fromkeys(r['provenance']['issues']))
 if allowed:
  r['provenance']['issues'].append('community_classification_inferred_from_supplied_evidence');added.append(r)
 else:remaining.append({'stagingId':e['stagingId'],'record':r,'reason':reason if reason=='missing_or_ambiguous_maps_match' else 'commune_unresolved' if not l.get('commune') else 'community_identity_not_established','evidence':evidence,'original':e})
 audit.append({'stagingId':e['stagingId'],'included':allowed,'record':r,'evidence':evidence})
merged={r['externalKey']:r for r in batch}
for r in added:
 if r['externalKey'] in merged:raise RuntimeError('Repeated identity requires explicit review')
 merged[r['externalKey']]=r
def nd(n,rows):(OUT/n).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows),encoding='utf-8')
nd('churches.import.ndjson',merged.values());nd('incorporaciones.ndjson',added);nd('revision.ndjson',remaining);nd('evidencias.ndjson',audit);nd('cambios.ndjson',changes)
with (OUT/'cambios.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['ID','Campo','Valor','Evidencia','Estado']);w.writerows([x['id'],x['field'],x['value'],json.dumps(x['evidence'],ensure_ascii=False),x['status']] for x in changes)
report={'reviewed':len(pending),'previousReady':len(batch),'added':len(added),'totalReady':len(merged),'remaining':len(remaining),'fieldsCompleted':dict(collections.Counter(x['field'] for x in changes)),'remainingReasons':dict(collections.Counter(x['reason'] for x in remaining))}
(OUT/'informe.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report))
