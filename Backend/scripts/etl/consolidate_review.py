"""Consolidación reproducible de pendientes. Decisiones editoriales del lote con trazabilidad."""
import json,re,unicodedata,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'data'
OUT=ROOT/'review-2026-09-30'
def readlines(p):return [json.loads(x) for x in p.read_text(encoding='utf-8-sig').splitlines() if x.strip()]
def fold(v):return ''.join(c for c in unicodedata.normalize('NFD',str(v or '').lower()) if not unicodedata.combining(c))
# Filas del Excel de mayo cuyo nombre identifica una persona, no una congregación.
PEOPLE={44,48,59,62,95,117,131,151,174,181,189,199,229,231,232,234,272,282,294,304,308,325,326,359,360,364,366,367,375,377,382,412,416,417,431,432,434,437,440,441,444,445,447,450,454,455,458,460,461,462,463,468,469,470,478,481}
# Entidades cuyo nombre representa comercio, administración, educación, patrimonio u otra actividad.
NON_CHURCH={56,58,61,68,69,70,71,90,91,92,98,124,140,142,144,149,167,176,190,235,269,270,278,281,287,298,307,309,329,351,352,365,371,376,385,386,387,395,398,400,404,407,409,413,414,419,425,426,427,428,435,436,438,439,448,456,465,467,473,474,475,476,477,479,480,482,483,486,495}
items=[]
for folder in sorted(ROOT.glob('google-maps-*')):
 review=folder/'review.ndjson'
 if not review.exists():continue
 for item in readlines(review):items.append({**item,'batchFolder':folder.name,'origin':'classification_review'})
 # Solo pendientes reales del resultado aplicado, no los planes preliminares.
 result=folder/'merge-result.json'
 if result.exists():
  records={r['externalKey']:r for r in readlines(folder/'churches.import.ndjson')}
  raw={r['record']['externalKey']:r.get('original',{}) for r in readlines(folder/'source-rows.ndjson')}
  for action in json.loads(result.read_text(encoding='utf-8'))['actions']:
   if action['action']=='review':items.append({'record':records[action['externalKey']],'original':raw.get(action['externalKey'],{}),'batchFolder':folder.name,'origin':'identity_review','reason':action['reason']})
excluded_ids={i['record']['externalKey'] for i in items if i['batchFolder']=='google-maps-2026-05-18' and i['record']['provenance']['sourceRow'] in PEOPLE|NON_CHURCH}
byid=collections.defaultdict(list)
for item in items:byid[item['record']['externalKey']].append(item)
results=[]
for key,group in byid.items():
 title=fold(group[-1]['record']['church']['identification']['name']);cats={fold(c) for i in group for c in i['record']['church']['externalProfile']['categories']}
 closed=any(str(v).lower()=='true' for i in group for k,v in i.get('original',{}).items() if k in ['permanentlyClosed','temporarilyClosed','isPermanentlyClosed'])
 closed=closed or bool(re.search(r'cerrad[oa] permanentemente|permanently closed|definitivamente cerrad',title))
 unrelated=bool(re.search(r'sociedad pesquera|hostal |sociedad de asesorias|soc de inversiones|cuaresma de fraternidad|cadena de television|comite nacional de educacion|instituto biblico nacional|oficinas generales|espinoza bautista eugenia|ramirez juan bautista|juan bautista cornejo amestica',title)) or bool(cats & {'abogado','parada de autobus','cadena de television','oficina estatal de educacion','synagogue'})
 if closed: decision,reason='excluded','explicit_closure'
 elif key in excluded_ids or unrelated:decision,reason='excluded','person_or_non_church_entity'
 elif title=='iglesia quemada':decision,reason='excluded','damaged_site_without_community_identity'
 elif title in {'marquitos','refugio','s v v','casa barbas','los canelos 850','auditorio','porvenir','trafi','santiago de chile','anderson','nueces para el amor','tierra latina','cruceiro','saint tropez','alvaro iglesia pacos'}:decision,reason='identity_unresolved','insufficient_evidence_of_church_identity'
 elif re.search(r'^arzobispado|curia provincial|inspectoria|comision de ministerios|asociacion cristiana femenina|sociedad de san vicente',title):decision,reason='excluded','religious_administration_or_association_not_local_church'
 else:decision,reason='candidate','plausible_community_activity_unverified'
 results.append({'externalKey':key,'name':group[-1]['record']['church']['identification']['name'],'decision':decision,'reason':reason,'activityStatus':'unverified','observations':group})
OUT.mkdir(exist_ok=True)
(OUT/'consolidated.ndjson').write_text(''.join(json.dumps(r,ensure_ascii=False,default=str)+'\n' for r in results),encoding='utf-8')
summary={'occurrences':len(items),'uniquePlaceIds':len(results),'decisions':dict(collections.Counter(r['decision'] for r in results)),'policy':'Actividad no verificada permitida solo como datos de prueba. Personas, entidades ajenas y cierres explícitos excluidos.','items':[dict(externalKey=r['externalKey'],name=r['name'],decision=r['decision'],reason=r['reason'],observations=len(r['observations'])) for r in results]}
(OUT/'inventory.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='items'},ensure_ascii=False))
