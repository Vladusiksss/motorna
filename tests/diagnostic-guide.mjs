import assert from 'node:assert/strict';
import {buildAnalysis,correctDescription} from '../app/diagnostic-guide.ts';
assert.equal(correctDescription('стукае спереди на ямах'),'стукає спереду на ямах');
assert.equal(correctDescription('не стукає і не гріється'),'не стукає і не гріється');
assert.equal(buildAnalysis('стукає','Audi', [{signal:'no_crank',evidence:'не крутить'}]).causes.length,0);
const bumps=buildAnalysis('стукає на ямах','Audi',[{signal:'bumps',evidence:'стукає на ямах'}]);
assert.ok(bumps.causes.length>3);assert.ok(bumps.causes.every(c=>c.check&&c.condition&&c.evidence));assert.ok(!bumps.causes.some(c=>c.parts.includes('Стартер')));
const unknown=buildAnalysis('не заводиться','Audi',[{signal:'starting_unknown',evidence:'не заводиться'}]);assert.equal(unknown.causes.length,0);assert.ok(unknown.questions.length);
const diesel=buildAnalysis('крутить нормально але не заводиться','Audi TDI дизель',[{signal:'no_crank',evidence:'крутить нормально'},{signal:'crank_no_start',evidence:'не заводиться'}]);assert.ok(!diesel.causes.some(c=>c.parts.includes('Стартер')||c.parts.includes('Свічки запалювання')));
console.log('PASS: corrections preserve negation, evidence grounding, expanded explanations, ambiguous starting, diesel exclusion, normal cranking exclusion');

assert.equal(buildAnalysis('На ямах не стукає, просто питаю про стартер','Audi',[{signal:'no_crank',evidence:'стартер'},{signal:'bumps',evidence:'На ямах не стукає'}]).causes.length,0);
assert.ok(buildAnalysis('стартер не круте тільки клацає','Audi',[{signal:'crank_no_start',evidence:'стартер не круте тільки клацає'}]).causes.some(c=>c.parts.includes('Стартер')));
assert.equal(buildAnalysis('машина тупіть','Audi',[{signal:'rough',evidence:'машина тупіть'}]).causes.length,0);
assert.ok(!buildAnalysis('клацає на ямах','Audi',[{signal:'bumps',evidence:'клацає на ямах'}]).causes.some(c=>c.parts.includes('Стартер')));
