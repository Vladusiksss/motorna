import assert from 'node:assert/strict';
import {validateVpicResult,VpicError,internationalResult} from '../app/vpic-validation.ts';
const valid={Make:'HONDA',Model:'Accord',ModelYear:'2003',ErrorCode:'0',PlantCountry:'JAPAN'};
assert.equal(validateVpicResult(valid).Make,'HONDA');
assert.equal(validateVpicResult({...valid,DisplacementL:null}).DisplacementL,'');
for(const raw of [null,{},[],{ErrorCode:''}])assert.throws(()=>validateVpicResult(raw),VpicError);
assert.equal(internationalResult(valid,'JHMCM56543C404453').Model,'Accord');
for(const [vin,make] of [['WVWZZZ1KZCW123456','VOLKSWAGEN'],['WAUZZZ8K9DA123456','AUDI'],['TMBJG7NE0G0123456','SKODA'],['VF1RFB00912345678','RENAULT']]){
 const result=internationalResult(validateVpicResult({ErrorCode:'1,5,14',ModelYear:'1982',Make:'',Model:'Guess'}),vin);
 assert.equal(result.Make,make);assert.equal(result.ModelYear,'');assert.equal(result.Model,'');
}
assert.equal(internationalResult({ErrorCode:'1',Make:'',Model:'',ModelYear:'2001'},'ZZZZZZZZZZZZZZZZZ').Make,'');
console.log('PASS: worldwide partial decoding, manufacturer recognition, no guessed model or year');
