import assert from 'node:assert/strict';
import {addPurchaseLine,purchaseText,purchaseTotals} from '../app/purchase-model.ts';
import {schemas} from '../app/validation.ts';
import {filterOffers,emptyOfferFilters} from '../app/offer-filters.ts';
const vehicle={carId:'11111111-1111-4111-8111-111111111111',vehicle:'AUDI A6 2014',vin:'WAUZZZ4G5EN130128'};
const line={title:'Тестова пропозиція · термостат',part:'Термостат',oem:'TEST123',url:'https://renix.ua/part/test/test123/',host:'renix.ua',price:1000.25,currency:'UAH',quantity:1,dataMode:'live',fitment:'unverified'};
let draft=addPurchaseLine(undefined,vehicle,line);
draft=addPurchaseLine(draft,vehicle,line);
assert.equal(draft.lines.length,1);assert.equal(draft.lines[0].quantity,2);
assert.deepEqual(purchaseTotals(draft.lines),[{currency:'UAH',amount:2000.5}]);
assert.deepEqual(purchaseTotals([...draft.lines,{...line,url:'https://renix.ua/other',price:20,currency:'EUR',quantity:3}]),[{currency:'UAH',amount:2000.5},{currency:'EUR',amount:60}]);
assert.throws(()=>addPurchaseLine(draft,{...vehicle,carId:'other'},line));
assert.throws(()=>addPurchaseLine(draft,vehicle,{...line,dataMode:'demo'}));
assert.equal(addPurchaseLine({...draft,lines:[{...line,quantity:99}]},vehicle,line).lines[0].quantity,99);
const request={carId:vehicle.carId,lines:draft.lines,note:'Уточніть комплектацію',status:'draft'};
assert(schemas.purchaseRequest.safeParse(request).success);
for(const changes of [{quantity:0},{quantity:1.5},{quantity:100},{dataMode:'demo'},{fitment:'verified'},{url:'javascript:alert(1)'},{currency:undefined}]){
 assert(!schemas.purchaseRequest.safeParse({...request,lines:[{...line,...changes}]}).success,JSON.stringify(changes));
}
assert(!schemas.purchaseRequest.safeParse({...request,status:'paid'}).success);
assert(!schemas.purchaseRequest.safeParse({...request,lines:[]}).success);
const inquiry={...line,url:undefined,host:undefined,price:undefined,currency:undefined,dataMode:'inquiry'};
assert(schemas.purchaseRequest.safeParse({...request,lines:[inquiry]}).success,'No provider access still permits an honest inquiry');
const text=purchaseText(draft);assert(text.includes(vehicle.vin));assert(text.includes('Сумісність за VIN не підтверджена'));assert(text.includes('не оплачене'));
const offers=[{title:'Колодки',host:'example.test',brand:'TRW',availability:'Є в наявності',numberMatch:true},{title:'Колодки',host:'example.test',brand:'Bosch',availability:'Наявність уточнюйте',numberMatch:false}];
assert.deepEqual(filterOffers(offers,{...emptyOfferFilters,brand:'TRW',inStock:true,exactNumber:true}),[offers[0]]);
console.log('PASS: selection → quantity → currency-safe totals → VIN/fitment inquiry → validated draft; demo and fake paid/verified states rejected');
