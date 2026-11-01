import {spawnSync} from 'node:child_process';
const tests=['vpic','free-vin','vehicle-resolution','catalog-number','offer-filters','offer-fitment','purchase-journey','maintenance','diagnostic-understanding','station-routing'];
for(const name of tests){
 const result=spawnSync(process.execPath,['--experimental-strip-types',`tests/${name}.mjs`],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
console.log(`${tests.length} regression suites passed`);
