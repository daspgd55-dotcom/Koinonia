"""Adaptador del export enriquecido en español. Conserva el Excel y evidencia original."""
import argparse, collections, hashlib, json, re
from pathlib import Path
import openpyxl
import google_maps as base


def transform_rich(row, number, filename, batch):
    adapted = dict(row)
    if not adapted.get('scrapedAt'):
        match = re.search(r'(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d{3})', filename)
        if not match:
            raise ValueError('El export sin scrapedAt debe tener fecha en el nombre')
        d,h,m,s,ms = match.groups()
        adapted['scrapedAt'] = f'{d}T{h}:{m}:{s}.{ms}Z'
    if 'region metropolitana' in base.fold(row.get('address')):
        adapted['state'] = 'Región Metropolitana'
    if not adapted.get('postalCode'):
        match = re.search(r'\b\d{7}\b', base.clean(row.get('address')))
        if match: adapted['postalCode'] = match.group()
    categories = list(dict.fromkeys(base.clean(v) for k,v in row.items() if (k == 'categoryName' or re.fullmatch(r'categories/\d+', k)) and base.clean(v)))
    for i in range(7):
        key = f'openingHours/{i}/day'
        day = base.fold(adapted.get(key))
        adapted[key] = next((d for d in base.DAYS.values() if base.fold(d)==day), adapted.get(key))
    record,status,reason = base.transform(adapted,number,filename,batch)
    church = record['church']; profile = church['externalProfile']; profile['categories'] = categories
    profile['capturedAtBasis'] = 'scrapedAt' if row.get('scrapedAt') else 'export_filename_timezone_unknown'
    if not row.get('scrapedAt'): record['provenance']['issues'].append('capture_time_unknown_export_filename_used_as_utc_placeholder')
    title = base.fold(row.get('title')); keys = [base.fold(c) for c in categories]
    if status != 'rejected':
        unrelated = re.search(r'\b(hostal|sociedad pesquera|sociedad de asesorias|soc de inversiones|parada \d|instituto biblico|comite nacional de educacion)\b', title)
        excluded_category = any(k in {'abogado','parada de autobus','cadena de television','oficina estatal de educacion'} for k in keys)
        church_category = any(k.startswith('iglesia') or k in {'catedral catolica','capilla','parroquia','basilica'} for k in keys)
        named = bool(re.search(r'\b(iglesia|parroquia|capilla|congregacion|templo|santuario|basilica|catedral|ministerio|asambleas de dios|centro evangelistico)\b', title))
        if unrelated or excluded_category: status,reason = 'excluded','non_church_entity'
        elif re.search(r'\b(iglesia quemada|cuaresma de fraternidad)\b', title): status,reason = 'review','activity_or_site_not_confirmed_as_community'
        elif church_category and (named or keys != ['iglesia']): status,reason = 'accepted','explicit_church_category'
        elif 'lugar de culto' in keys and named: status,reason = 'accepted','named_christian_worship_place'
        else: status,reason = 'review','ambiguous_name_or_category'
    links,media,phones,emails = {},{},set(),set()
    for key,value in row.items():
        if not value: continue
        if re.fullmatch(r'(phones|emails)/\d+',key) or key.endswith('/phone') or key in {'phone','phoneUnformatted'}:
            phone = base.normalize_phone(value)
            if phone: phones.add(phone)
        if re.fullmatch(r'emails/\d+',key) or key.endswith('/email'):
            email = base.clean(value).lower()
            if re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email): emails.add(email)
        url = base.valid_url(value)
        if not url: continue
        if key == 'imageUrl' or key.endswith(('/profilePictureURL','/coverPhoto')):
            if len(url)<=2000: media.setdefault(url,{'type':'image','url':url,'source':'google_maps_export:'+key})
        elif key not in {'url'}:
            # Conservar candidatos externos sin atribuirles carácter institucional.
            kind = key.split('/')[0]
            links.setdefault(url,{'kind':kind,'url':url})
    profile.update(links=list(links.values()),phones=sorted(phones),emails=sorted(emails))
    if media: church['media'] = list(media.values())[:30]
    if any(k.endswith(('/profilePictureURL','/coverPhoto')) and v for k,v in row.items()):
        record['provenance']['issues'].append('social_profiles_and_images_require_association_review')
    return record,status,reason


def run(source,output):
    source,output=Path(source),Path(output); output.mkdir(parents=True,exist_ok=True)
    digest=hashlib.sha256(source.read_bytes()).hexdigest(); batch='google_maps_'+digest[:16]
    w=openpyxl.load_workbook(source,read_only=True,data_only=True); s=w['Data']; rows=s.iter_rows(values_only=True); headers=next(rows)
    items=[]
    for number,values in enumerate(rows,2):
        if all(v is None for v in values): continue
        raw=dict(zip(headers,values)); record,status,reason=transform_rich(raw,number,source.name,batch)
        items.append(dict(record=record,disposition=status,reason=reason,original=raw))
    w.close()
    # Unión de atributos de filas repetidas con el mismo Place ID.
    seen={}
    for item in items:
        if item['disposition']!='accepted': continue
        record=item['record']; key=record['externalKey']
        if key in seen:
            first=seen[key]['church']; newer=record['church']
            for field in ['links','phones','emails']:
                values=first['externalProfile'].get(field,[])+newer['externalProfile'].get(field,[])
                first['externalProfile'][field]=list({json.dumps(v,sort_keys=True):v for v in values}.values())
            first['media']=list({v['url']:v for v in first.get('media',[])+newer.get('media',[])}.values())[:30]
            item['disposition']='duplicate'; item['reason']='same_place_id_merged'
        else: seen[key]=record
    def write(name,data):
        (output/name).write_text(''.join(json.dumps(x,ensure_ascii=False,default=str,allow_nan=False)+'\n' for x in data),encoding='utf-8')
    accepted=[i['record'] for i in items if i['disposition']=='accepted']
    write('churches.import.ndjson',accepted); write('review.ndjson',[i for i in items if i['disposition']!='accepted']); write('source-rows.ndjson',items)
    report=dict(sourceFile=source.name,sourceSha256=digest,inputRows=len(items),columns=len(headers),dispositions=dict(collections.Counter(i['disposition'] for i in items)),images=sum(len(r['church'].get('media',[])) for r in accepted),records=[dict(row=i['record']['provenance']['sourceRow'],name=i['record']['church']['identification']['name'],status=i['disposition'],reason=i['reason']) for i in items])
    (output/'quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='records'},ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--input',required=True); p.add_argument('--output',required=True); a=p.parse_args(); run(a.input,a.output)
