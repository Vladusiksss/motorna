import assert from 'node:assert/strict';
const symptoms='натискаю на газ а вона довго думає після чого повільно їде та туго набирає оберти';
const history=[];
for(const answer of [null,'Check Engine не горить. На прогрітому двигуні, на холодному їде нормально.','Диму немає, після перезапуску нічого не змінюється.']){
 if(answer)history.push({role:'user',content:answer});
 const r=await fetch('http://localhost:5173/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vehicle:'Audi A6 2014 3.0 TDI дизель',symptoms,history})});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));console.log(JSON.stringify({questions:d.questions,causes:d.causes?.map(x=>x.title)}));assert.ok(d.causes.length);assert.ok(!d.causes.some(c=>c.parts.includes('Стартер')));for(const q of d.questions)assert.ok(!history.some(m=>m.role==='assistant'&&m.content.includes(q)));history.push({role:'assistant',content:[d.note,...d.questions].join('\n')});
}
console.log('PASS: three-turn contextual conversation');
