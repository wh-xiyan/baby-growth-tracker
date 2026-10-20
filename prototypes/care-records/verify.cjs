const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
for(const mode of [1,2,3]){
 const html=fs.readFileSync(path.join(__dirname,`option-${mode}.html`),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 new vm.Script(script);
 const nodes=new Map();
 const node=k=>{if(!nodes.has(k))nodes.set(k,{value:'',textContent:'',innerHTML:'',showModal(){this.open=true},close(){this.open=false}});return nodes.get(k)};
 const context=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>({remove(){}}),body:{appendChild(){}}},window:{scrollY:112,scrollTo(){},location:{}},setTimeout(){},console});
 vm.runInContext(script,context);
 const run=s=>vm.runInContext(s,context);
 assert.equal(run('visibleRecords().length'),6);
 run('preset(7)');assert.equal(run('visibleRecords().length'),14);
 run("setCategory('feeding')");assert.equal(run('visibleRecords().length'),6);
 run("setSubtype('solid')");assert.equal(run('visibleRecords().length'),2);
 assert.equal(run("amount(rangeRecords(),'formula')"),390);
 run("setCategory('sleep')");assert.equal(run('visibleRecords().length'),3);
 run("entry('feeding')");assert.equal(run('state.start'), '2026-10-20');assert.equal(run('visibleRecords().length'),3);
 if(mode!==2){run("openDetail('b')");assert.equal(run('state.view'),'detail');assert.ok(node('main').innerHTML.includes('飞鹤'));assert.ok(!node('main').innerHTML.includes('formula'));run('back()');assert.equal(run('state.view'),'list');assert.equal(run('state.category'),'feeding')}
 else{assert.ok(node('main').innerHTML.includes('<details'));assert.ok(!node('main').innerHTML.includes('查看完整记录'));run("rememberExpanded({open:true,dataset:{id:'b'}})");assert.equal(run('state.expanded'),'b')}
 if(mode===3){run('back()');assert.equal(run('state.view'),'overview');run("openDay('2026-10-19')");assert.equal(run('state.day'),'2026-10-19');assert.equal(run('visibleRecords().length'),0);run('preset(7)');run("openDay('2026-10-19')");assert.equal(run('visibleRecords().length'),3);run('back()');run("openCategory('diaper')");assert.equal(run('visibleRecords().length'),3)}
 node('#range-start').value='2026-10-21';node('#range-end').value='2026-10-20';run('applyDates()');assert.ok(node('#date-error').textContent);
 node('#range-start').value='2026-10-01';node('#range-end').value='2026-10-02';run('applyDates()');assert.equal(run('visibleRecords().length'),0);assert.ok(node('main').innerHTML.includes('还没有'));
 run("entry('feeding');openAdd()");node('#add-subtype').value='formula';node('#add-amount').value='130';node('#add-extra').value='<test>';run('saveRecord()');assert.equal(run('visibleRecords().length'),4);assert.equal(run('records[records.length-1].amount'),130);assert.ok(node('main').innerHTML.includes('&lt;test&gt;'));
 run("openAdd()");node('#add-amount').value='-1';run('saveRecord()');assert.ok(node('#add-error').textContent);assert.equal(run('visibleRecords().length'),4);
 if(mode===1){
  run("entry('all');preset(7)");
  assert.equal(run("state.dateGroups['2026-10-20']"),true);
  assert.equal(run("Boolean(state.dateGroups['2026-10-19'])"),false);
  run("rememberDateGroup({dataset:{date:'2026-10-19'},open:true});openDetail('g');back()");
  assert.equal(run("state.dateGroups['2026-10-19']"),true);
  run('setAllDateGroups(true)');assert.equal(run('Object.values(state.dateGroups).every(Boolean)'),true);
  run('setAllDateGroups(false)');assert.equal(run('Object.values(state.dateGroups).some(Boolean)'),false);
  run("setCategory('sleep')");assert.equal(run("state.dateGroups['2026-10-20']"),true);
  assert.equal(run("Boolean(state.dateGroups['2026-10-19'])"),false);
  console.log('PASS date accordion: nearest day default, manual toggle, detail-return preservation, expand/collapse all and filter reset');
 }
 console.log(`PASS option ${mode}: script syntax, date ranges, categories, subtypes, sums, navigation, empty states, add validation and escaping`);
}
