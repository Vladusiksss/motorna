import os, re, secrets, threading, time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from import_mvs import connection, schema, update, present
from datetime import datetime

def updater():
    while True:
        try:
            changes=update([datetime.now().year-1,datetime.now().year])
            print('MVS update check complete; changed resources:',len(changes),flush=True)
        except Exception as exc: print('MVS update failed:',type(exc).__name__,flush=True)
        time.sleep(86400) # Check resource revision daily; download only changed monthly files.
@asynccontextmanager
async def lifespan(app):
    with connection() as db: schema(db)
    if os.getenv('MVS_AUTO_UPDATE','1')=='1': threading.Thread(target=updater,daemon=True).start()
    yield
app=FastAPI(title='МОТОРНА — реєстр авто',lifespan=lifespan)
class Lookup(BaseModel): identifier:str=Field(min_length=6,max_length=25)
def authorize(authorization):
    token=os.getenv('MVS_API_TOKEN')
    if token and not secrets.compare_digest(authorization or '',f'Bearer {token}'): raise HTTPException(401,'Unauthorized')
@app.get('/health')
def health():
    with connection() as db:
        count=db.execute('SELECT count(*) FROM mvs_vehicles').fetchone()[0]
        latest=db.execute('SELECT max(imported_at) FROM mvs_imports').fetchone()[0]
        return {'ready':count>0,'vehicles':count,'autoUpdate':os.getenv('MVS_AUTO_UPDATE','1')=='1','lastImport':latest}
@app.post('/lookup')
def lookup(body:Lookup,authorization:str|None=Header(default=None)):
    authorize(authorization)
    value=re.sub(r'[\s-]','',body.identifier.upper())
    if not re.fullmatch(r'[A-HJ-NPR-Z0-9]{17}',value): raise HTTPException(422,'VIN має містити 17 латинських літер і цифр без I, O та Q.')
    with connection() as db:
        row=db.execute('SELECT registered,payload FROM mvs_vehicles WHERE vin=%s',(value,)).fetchone()
    if not row: raise HTTPException(404,'Автомобіль не знайдено у завантажених реєстраціях.')
    return {'vehicle':present(value,row[0],row[1])}


