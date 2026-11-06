import {spawnSync} from 'node:child_process';
const tests=['money-migration','api-errors','json-body','mutation-security','vpic','free-vin','vehicle-resolution','catalog-number','offer-filters','offer-fitment','purchase-journey','maintenance','diagnostic-understanding','station-routing','car-catalog','document-upload','access-security','health','record-types','api-contracts','record-integrity','records-pagination','record-client'];
for(const name of tests){
 const result=spawnSync(process.execPath,['--experimental-strip-types',`tests/${name}.mjs`],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
console.log(`${tests.length} regression suites passed`);
