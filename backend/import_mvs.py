"""MVS vehicle-only ingestion. No owner, address or person fields are retained."""
import argparse, csv, hashlib, io, json, os, re, tempfile, urllib.request, zipfile
from datetime import datetime
from pathlib import Path
import psycopg
from psycopg.types.json import Jsonb
DATASET = 'https://data.gov.ua/api/3/action/package_show?id=06779371-308f-42d7-895e-5a39833375f0'
FIELDS = {'BRAND':'Марка','MODEL':'Модель','MAKE_YEAR':'Рік','COLOR':'Колір','KIND':'Тип','PURPOSE':'Призначення','BODY':'Кузов','FUEL':'Паливо','CAPACITY':'Об’єм двигуна, см³','POWER_KWT':'Потужність, кВт','OWN_WEIGHT':'Споряджена маса, кг','TOTAL_WEIGHT':'Повна маса, кг'}
def connection():
    return psycopg.connect(os.environ.get('DATABASE_URL','postgresql://motorna@127.0.0.1:55432/motorna'))
def schema(db):
    db.execute('CREATE TABLE IF NOT EXISTS mvs_vehicles (vin text PRIMARY KEY, registered date NOT NULL, payload jsonb NOT NULL, resource text NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS mvs_imports (resource text PRIMARY KEY, fingerprint text NOT NULL, rows bigint NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(), plate_available boolean NOT NULL DEFAULT false)')
    db.commit()
def vehicle(row):
    vin=re.sub(r'\s','',row.get('VIN','').upper())
    if not re.fullmatch(r'[A-HJ-NPR-Z0-9]{17}',vin): return None
    date=None
    for fmt in ('%d.%m.%y','%d.%m.%Y','%Y-%m-%d','%d.%m.%Y %H:%M:%S','%Y-%m-%d %H:%M:%S'):
        try: date=datetime.strptime(row.get('D_REG','').strip(),fmt).date(); break
        except ValueError: pass
    if date is None: return None
    return vin,date,{key:row[key].strip() for key in FIELDS if row.get(key,'').strip()}

def present(vin,date,raw):
    # Older expanded records remain readable during an upgrade.
    if 'fields' in raw: return raw
    return {'vin':vin,'make':raw.get('BRAND',''),'model':raw.get('MODEL',''),'year':raw.get('MAKE_YEAR',''),
        'engine':' · '.join(filter(None,[raw.get('CAPACITY','')+' см³' if raw.get('CAPACITY') else '',raw.get('FUEL','')])),
        'fields':[{'label':label,'value':raw[key]} for key,label in FIELDS.items() if raw.get(key)],
        'warning':'','source':'Відкриті дані МВС','checkedAt':str(date)}

def import_file(path,resource,fingerprint=None):
    if not fingerprint:
        with open(path,'rb') as file: fingerprint=hashlib.file_digest(file,'sha256').hexdigest()
    with connection() as db:
        schema(db)
        if db.execute('SELECT 1 FROM mvs_imports WHERE resource=%s AND fingerprint=%s',(resource,fingerprint)).fetchone(): return {'skipped':True,'resource':resource}
        if not db.execute('SELECT pg_try_advisory_lock(763421)').fetchone()[0]: raise RuntimeError('Імпорт уже виконується')
        db.execute('CREATE TEMP TABLE staging (vin text, registered date, payload jsonb) ON COMMIT PRESERVE ROWS')
        def flush(batch):
            with db.cursor().copy('COPY staging(vin,registered,payload) FROM STDIN') as copy:
                for vin,date,payload in batch: copy.write_row((vin,date,Jsonb(payload)))
            db.execute("""INSERT INTO mvs_vehicles SELECT DISTINCT ON (vin) vin,registered,payload,%s FROM staging ORDER BY vin,registered DESC,payload::text DESC ON CONFLICT(vin) DO UPDATE SET registered=excluded.registered,payload=excluded.payload,resource=excluded.resource WHERE excluded.registered>=mvs_vehicles.registered AND (excluded.payload IS DISTINCT FROM mvs_vehicles.payload OR excluded.registered IS DISTINCT FROM mvs_vehicles.registered)""",(resource,))
            db.execute('TRUNCATE staging');db.commit()
        archive=zipfile.ZipFile(path) if zipfile.is_zipfile(path) else None
        members=[n for n in archive.namelist() if n.lower().endswith('.csv')] if archive else [None]
        if not members: raise ValueError('CSV missing')
        count=0;batch=[]
        try:
            for member in members:
                raw=archive.open(member) if archive else open(path,'rb');head=raw.read(4096);raw.close()
                try: head.decode('utf-8-sig');encoding='utf-8-sig'
                except UnicodeDecodeError: encoding='cp1251'
                raw=archive.open(member) if archive else open(path,'rb')
                with io.TextIOWrapper(raw,encoding=encoding,newline='') as stream:
                    sample=head.decode(encoding,errors='replace').splitlines()[0]
                    reader=csv.DictReader(stream,delimiter=';' if sample.count(';')>sample.count(',') else ',')
                    if not {'VIN','D_REG','BRAND','MODEL'}.issubset(reader.fieldnames or []): raise ValueError('Unexpected MVS schema')
                    for row in reader:
                        value=vehicle(row)
                        if value:
                            batch.append(value);count+=1
                            if len(batch)>=5000: flush(batch);batch=[]
                            if count%100000==0: print(f'Imported {count} rows',flush=True)
            if batch: flush(batch)
            if not count: raise ValueError('No valid VIN rows')
            # Mark complete only after every batch succeeds. Interrupted imports retry safely.
            db.execute("""INSERT INTO mvs_imports(resource,fingerprint,rows,plate_available) VALUES(%s,%s,%s,false) ON CONFLICT(resource) DO UPDATE SET fingerprint=excluded.fingerprint,rows=excluded.rows,imported_at=now()""",(resource,fingerprint,count));db.commit()
        finally:
            if archive: archive.close()
    return {'resource':resource,'rows':count}

def update(years):
    request=urllib.request.Request(DATASET,headers={'User-Agent':'Motorna-MVS-importer/1.0'})
    with urllib.request.urlopen(request,timeout=60) as response: metadata=json.load(response)
    if not metadata.get('success'): raise RuntimeError('CKAN unavailable')
    results=[]
    for r in metadata['result']['resources']:
        if not any(str(y) in r.get('name','') for y in years) or r.get('format','').upper() not in ('ZIP','CSV'): continue
        url=r['url']
        if not url.startswith('https://data.gov.ua/'): continue
        fingerprint=r.get('last_modified') or r.get('hash') or ''
        with connection() as db:
            schema(db)
            if fingerprint and db.execute('SELECT 1 FROM mvs_imports WHERE resource=%s AND fingerprint=%s',(r['id'],fingerprint)).fetchone(): continue
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'download'
            with urllib.request.urlopen(url,timeout=180) as response,open(path,'wb') as out:
                import shutil;shutil.copyfileobj(response,out)
            results.append(import_file(path,r['id'],fingerprint or None))
    return results
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--file');parser.add_argument('--fingerprint');parser.add_argument('--resource',default='manual');parser.add_argument('--years',nargs='+',type=int,default=[datetime.now().year-1,datetime.now().year]);args=parser.parse_args()
    print(json.dumps(import_file(args.file,args.resource,args.fingerprint) if args.file else update(args.years),ensure_ascii=False))

