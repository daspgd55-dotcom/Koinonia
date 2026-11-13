import json,csv,re,unicodedata
from pathlib import Path
p=Path(__file__).parent
fold=lambda x:re.sub(r'[^a-z0-9]+',' ',''.join(c for c in unicodedata.normalize('NFD',x.lower()) if not unicodedata.combining(c))).strip()
records=[json.loads(s) for s in (p/'churches.import.ndjson').read_text(encoding='utf-8').splitlines()];text=(p/'contactos-iglesias.csv').read_text(encoding='utf-8-sig');rows=list(csv.DictReader(text.splitlines(),delimiter=';' if ';' in text.splitlines()[0] else ','));updates={};unmatched=[]
for row in rows:
 matches=[r for r in records if fold(r['church']['identification']['name'])==fold(row['Iglesia'])]
 if len(matches)!=1:unmatched.append(row);continue
 r=matches[0];c=r['church'];patch={}
 for col,key in [('Correo','email'),('Pagina web','website'),('Facebook','facebook'),('Instagram','instagram'),('Youtube','youtube'),('Telefono','phone')]:
  v=row.get(col,'').strip()
  if not v:continue
  if key=='phone':v='+'+re.sub(r'\D','',v)
  if key=='email':
   values=re.findall(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}',v);assert values,v;c['externalProfile']['emails']=values;v=values[0]
  c.setdefault('contact',{})[key]=v;patch['contact.'+key]=v
 for col,key in [('Direccion','address'),('Comuna','commune')]:
  v=row.get(col,'').strip()
  if v:c['location'][key]=v;patch['location.'+key]=v
 r['provenance']['issues'].append('contacts_updated_by_user_csv');updates[r['externalKey']]=patch
(p/'churches.updated.ndjson').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records),encoding='utf-8');(p/'contact-updates.json').write_text(json.dumps(updates,ensure_ascii=False,indent=2),encoding='utf-8');(p/'unmatched-contacts.json').write_text(json.dumps(unmatched,ensure_ascii=False,indent=2),encoding='utf-8');print({'csvRows':len(rows),'matched':len(updates),'unmatched':len(unmatched),'withEmail':sum(bool(r['church'].get('contact',{}).get('email') or r['church']['externalProfile'].get('emails')) for r in records)})
