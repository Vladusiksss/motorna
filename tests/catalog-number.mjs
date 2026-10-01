import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {matchesCatalogNumber,extractOffers}=await import('../app/product-offers.ts');
const offer={title:'Термостат 059 121 111 N',catalogNumbers:[]};
assert.ok(matchesCatalogNumber(offer,'059121111N'));
assert.ok(!matchesCatalogNumber(offer,'059121111'));
assert.ok(!matchesCatalogNumber({...offer,title:'Термостат 059121111NX'},'059121111N'));
assert.ok(matchesCatalogNumber({...offer,title:'Термостат',catalogNumbers:['059-121-111-N']},'059121111N'));
const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Термостат Audi A6',mpn:'059121111N',offers:{'@type':'Offer',price:1000,priceCurrency:'UAH'}})+'</script>';
const result=extractOffers(html,'https://prom.ua/p123-test.html','Термостат');assert.ok(matchesCatalogNumber(result[0],'059121111N'));assert.equal(result[0].price,1000);
console.log('PASS: exact catalog number, suffix mismatch, structured MPN extraction and observed price');

const byNumber=extractOffers(html,'https://prom.ua/p123-test.html','059121111N','059121111N');
assert.equal(byNumber.length,1,'OEM-only search accepts structured MPN without number in title');
assert.equal(extractOffers(html,'https://prom.ua/p123-test.html','059121111X','059121111X').length,0);

const {matchesVehicle}=await import('../app/product-offers.ts');
assert.equal(matchesVehicle('Колодки Audi A6 С5 VW Passat B5','AUDI A6 2014','A6'),false);
