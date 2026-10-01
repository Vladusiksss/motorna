import assert from 'node:assert/strict';
import {searchIntent} from '../app/search-intent.ts';
assert.equal(searchIntent('WAUZZZ4G0EN000001').kind,'vin');assert.equal(searchIntent('стукає двигун').kind,'problem');assert.equal(searchIntent('059121111N').kind,'oem');assert.equal(searchIntent('СТО поруч').kind,'service');assert.equal(searchIntent('косточка').text,'стійка стабілізатора');console.log('PASS: VIN, symptom, OEM, service and colloquial part routing');
