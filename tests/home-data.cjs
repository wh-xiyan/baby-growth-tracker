const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const vm = require('node:vm')
const source = ts.transpileModule(fs.readFileSync('src/utils/home.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const scope = {exports:{}}
vm.runInNewContext(source,scope)
const { localDate, todayCare, measurementPoints, isMeasurement } = scope.exports
assert.equal(localDate('2026-10-11T16:30:00Z'),'2026-10-12')
const record = (id, category, occurredAt, metrics={}) => ({id,category,occurredAt,metrics})
const records = [
 record('1','feeding','2026-10-11T16:30:00Z'),
 record('2','feeding','2026-10-12T09:00:00+08:00',{feedingType:'solid_food'}),
 record('3','sleep','2026-10-11T23:00:00+08:00',{sleepStart:'2026-10-11T23:00:00+08:00',sleepEnd:'2026-10-12T02:00:00+08:00'}),
 record('4','sleep','2026-10-12T23:00:00+08:00',{sleepStart:'2026-10-12T23:00:00+08:00',sleepEnd:'2026-10-13T02:00:00+08:00'}),
 record('5','diaper','2026-10-12T06:00:00+08:00'),
]
const care=todayCare(records,'2026-10-12')
assert.equal(care.feeds,1)
assert.equal(care.diapers,1)
assert.equal(care.sleepMinutes,180)
assert.equal(isMeasurement(record('6','milestone','2026-10-12',{height:78})),true)
assert.equal(isMeasurement(record('7','milestone','2026-10-12')),false)
const points=measurementPoints([record('8','measurement','2026-10-12',{weight:10}),record('9','measurement','2026-10-10',{height:78})],'height')
assert.equal(points.length,1)
assert.equal(points[0].value,78)
console.log('PASS: Shanghai day boundaries, cross-midnight sleep, feeding separation, legacy measurement compatibility and independent metrics')

// Verify record mutation validation and cross-family ownership using a mocked DB.
const validationSource = ts.transpileModule(fs.readFileSync('cloud/shared/records.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const db={collection:()=>({doc:()=>({get:async()=>({data:{familyId:'family-b'}})})})}
const validationScope={exports:{},require:()=>({db})}
vm.runInNewContext(validationSource,validationScope)
const {validateRecord,ownedDocument}=validationScope.exports
const base={category:'measurement',title:'身体测量',occurredAt:'2026-10-12T08:00:00+08:00',metrics:{height:78}}
assert.equal(validateRecord(base).occurredAt.toISOString(),'2026-10-12T00:00:00.000Z')
assert.throws(()=>validateRecord({...base,category:'invalid'}),/INVALID_RECORD/)
assert.throws(()=>validateRecord({...base,metrics:{height:-1}}),/INVALID_METRICS/)
assert.throws(()=>validateRecord({...base,metrics:{}}),/MEASUREMENT_REQUIRED/)
assert.rejects(ownedDocument('growth_records','record-id','family-a'),/NOT_FOUND/).then(()=>console.log('PASS: record validation and cross-family mutation rejection'))
