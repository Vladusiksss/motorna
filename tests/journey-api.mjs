// Destructive cleanup is restricted to records created by this local test run.
import assert from 'node:assert/strict';
const base=process.env.MOTORNA_TEST_URL||'http://localhost:5173';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Run only against a local disposable test server.');
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'Local development sign-in');
const created=[];
async function api(path,method='GET',body,auth=true){return fetch(base+path,{method,headers:{'content-type':'application/json',...(auth?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
async function create(kind,data){const response=await api('/api/records','POST',{kind,data});assert.equal(response.status,201,await response.clone().text());const {record}=await response.json();created.push(record.id);return record;}
try{
 assert.equal((await api('/api/records','GET',undefined,false)).status,401);
 const car=await create('car',{name:'TEST Honda Accord',make:'HONDA',model:'Accord',year:2003,engine:'3.0 Gasoline',vin:'1HGCM82633A004352',mileage:150000,nextService:160000,nextServiceDate:'2027-01-01'});
 const lookup=await api('/api/vehicle','POST',{identifier:car.data.vin});assert.equal(lookup.status,200);assert.equal((await lookup.json()).vehicle.model,'Accord');
 const analysis=await api('/api/analyze','POST',{vehicle:car.data.name,symptoms:'P0302',history:[]});assert.equal(analysis.status,200);assert.match((await analysis.json()).note,/P0302/);
 const line={title:'Test inquiry, no seller quote',part:'Термостат',oem:'TEST123',quantity:2,dataMode:'inquiry',fitment:'unverified'};
 const request=await create('purchaseRequest',{carId:car.id,lines:[line],note:'Local API integration test',status:'draft'});
 assert.equal(request.data.vin,car.data.vin);assert.equal(request.data.status,'draft');
 const list=await api('/api/records');assert.ok((await list.json()).records.some(r=>r.id===request.id));
 const file=await api('/api/purchase-request/'+request.id);assert.equal(file.status,200);assert.match(file.headers.get('content-disposition'),/attachment/);assert.match(await file.text(),/1HGCM82633A004352/);
 assert.equal((await api('/api/purchase-request/'+request.id,'GET',undefined,false)).status,401);
 assert.equal((await api('/api/records','POST',{kind:'purchaseRequest',data:{carId:car.id,lines:[{...line,dataMode:'demo'}],status:'draft'}})).status,400);
 const foreign=await api('/api/records','POST',{kind:'purchaseRequest',data:{carId:crypto.randomUUID(),lines:[line],status:'draft'}});assert.equal(foreign.status,404);
 console.log('PASS API journey: local sign-in → saved VIN car → diagnostics → private inquiry → persistence → TXT; invalid and anonymous requests rejected');
}finally{
 for(const id of created.reverse()){const response=await api('/api/records?id='+id,'DELETE');assert.equal(response.status,200,'Test record cleanup');}
}
