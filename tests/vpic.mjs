import assert from 'node:assert/strict';
import {validateVpicResult,VpicError} from '../app/vpic-validation.ts';
const valid={Make:'HONDA',Model:'Accord',ModelYear:'2003',ErrorCode:'0',PlantCountry:'JAPAN'};
assert.equal(validateVpicResult(valid).Make,'HONDA');
assert.equal(validateVpicResult({...valid,DisplacementL:null}).DisplacementL,'');
for(const raw of [null,{}, {...valid,ErrorCode:'1'}, {...valid,ErrorCode:'0; 6'}, {...valid,ErrorCode:''}, {...valid,Model:''}, {...valid,ModelYear:'unknown'}])assert.throws(()=>validateVpicResult(raw),VpicError);
console.log('PASS: complete decoding, errors, missing data, and no country-of-assembly restriction');
