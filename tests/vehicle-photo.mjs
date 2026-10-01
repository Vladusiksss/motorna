import assert from 'node:assert/strict';
import {photoMatches,photoYearMatches,photoQuery} from '../app/vehicle-photo-search.ts';
const p={make:'Audi',model:'A6',year:'2014',body:'sedan',color:'#20232a'};
assert.equal(photoMatches('Audi A6 C7 black sedan',p),true);
assert.equal(photoMatches('Audi A6L C7 black sedan',p),false);
assert.equal(photoMatches('Audi A6 blue sedan',p),false);
assert.equal(photoMatches('Audi A6 black wagon',p),false);
assert.equal(photoMatches('Audi A6 black sedan interior',p),false);
assert.equal(photoMatches('Audi A6 black sedan', {...p,model:'A4'}),false);
assert.ok(!photoQuery(p).includes('VIN'));
console.log('PASS: photo make/model/color/body matching and exclusions');
assert.equal(photoMatches('Mercedes-Benz E400 Coupé', {make:'MERCEDES-BENZ',model:'E 400',year:'2016',body:'coupe',color:'#000000'}),true);

const rs7={make:'Audi',model:'RS7',year:'2021',body:'hatch',color:'#000000'};
assert.equal(photoYearMatches('2012 Audi RS7 photographed in 2021',rs7),false);
assert.equal(photoYearMatches('Audi RS7 2012 2021-06-12',rs7),false);
assert.equal(photoYearMatches('2021 Audi RS7',rs7),true);
assert.equal(photoYearMatches('Audi RS7 (2021)',rs7),true);
assert.equal(photoYearMatches('Audi RS7',rs7),false);
console.log('PASS: exact model-year evidence; old model and capture dates rejected');

const blackRs7={...rs7,color:'#20232a'};
assert.equal(photoMatches('2021 Audi RS7 black sportback',blackRs7),true);
assert.equal(photoMatches('2021 Audi RS7 blue sportback',blackRs7),false);
assert.equal(photoMatches('2021 Audi RS7 black wagon',blackRs7),false);
assert.ok(photoQuery(blackRs7).includes('black'));
assert.ok(photoQuery(blackRs7).includes('2021'));
console.log('PASS: VIN color, body and year retained in model photo selection');

const {verifiedModelPhoto}=await import('../app/verified-model-photos.ts');
assert.ok(verifiedModelPhoto(blackRs7));
assert.ok(verifiedModelPhoto({...blackRs7,model:'RS 7'}));
for(const changed of [{year:'2012'},{color:'#195cb2'},{body:'wagon'},{model:'RS6'}])assert.equal(verifiedModelPhoto({...blackRs7,...changed}),null);
