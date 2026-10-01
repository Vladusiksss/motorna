import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {extractModelPhotos,photoSearchLinks}=await import('../app/web-model-photos.ts');
const p={make:'Audi',model:'RS7',year:'2021',body:'hatch',color:'#20232a'};
const car={'@type':'Car',name:'2021 Audi RS 7 Sportback',vehicleModelDate:'2021',color:'Mythos Black',bodyType:'Sportback',image:'https://auto.ria.com/car.jpg'};
const html=x=>'<script type="application/ld+json">'+JSON.stringify(x)+'</script>';
assert.equal(extractModelPhotos(html(car),'https://auto.ria.com/auto_test.html',p).length,1);
for(const changed of [{color:'Blue'},{vehicleModelDate:'2012'},{bodyType:'Wagon',name:'2021 Audi RS7'},{image:'http://127.0.0.1/private'},{name:'2021 Audi RS6'}])assert.equal(extractModelPhotos(html({...car,...changed}),'https://auto.ria.com/auto_test.html',p).length,0);
assert.deepEqual(photoSearchLinks('<a href="/url?q=https%3A%2F%2Fauto.ria.com%2Fauto_test.html&amp;sa=U">car</a><a href="http://127.0.0.1">bad</a>'),['https://auto.ria.com/auto_test.html']);
console.log('PASS: Google result links, RS 7 alias, same-vehicle metadata, year/color/body mismatches and image host restrictions');

const preview='<meta property="og:title" content="2021 Audi RS 7 Sportback"><meta property="og:description" content="Black exterior"><meta property="og:image" content="https://auto.ria.com/front.jpg">';
assert.equal(extractModelPhotos(preview,'https://auto.ria.com/auto_test.html',p).length,1);
assert.equal(extractModelPhotos(preview,'https://auto.ria.com/search/',p).length,0);
assert.equal(extractModelPhotos(preview.replace('Black exterior','Blue exterior'),'https://auto.ria.com/auto_test.html',p).length,0);
assert.equal(extractModelPhotos(html({...car,vehicleModelDate:'2012'})+preview,'https://auto.ria.com/auto_test.html',p).length,0);
console.log('PASS: primary preview extraction, search pages and conflicting vehicle data rejected');

const {marketplaceQueries}=await import('../app/web-model-photos.ts');
assert.equal(marketplaceQueries(p).length,3);
assert.ok(marketplaceQueries(p)[0].includes('site:auto.ria.com'));
assert.ok(marketplaceQueries(p)[1].includes('site:mobile.de'));
assert.ok(marketplaceQueries(p).every(q=>q.includes('2021')&&q.includes('black')));
