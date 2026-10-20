const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const load = (file, deps) => {
  const scope = { exports: {}, require: (name) => {
    if (!(name in deps)) throw new Error(`Unmocked dependency: ${name}`)
    return deps[name]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText, scope)
  return scope.exports
}
const view = load('src/utils/vaccine-detail.ts', { './home': { localDate: () => '2026-10-20' } })
const base = { id: 'a', familyId: 'family-a', childId: 'child-a', seriesId: 's1', catalogId: 'cat', name: '水痘', doseNumber: 2, plannedDate: '2026-10-28', status: 'planned', reminderEnabled: true }
assert.equal(view.vaccineStatus(base).caption, '距离计划日期还有 8 天')
assert.equal(view.vaccineStatus({ ...base, plannedDate: '2026-10-20' }).label, '今天接种')
assert.equal(view.vaccineStatus({ ...base, plannedDate: '2026-10-17' }).tone, 'overdue')
assert.equal(view.vaccineStatus({ ...base, status: 'completed' }).label, '已接种')
assert.equal(view.vaccineStatus({ ...base, status: 'skipped' }).label, '已跳过')
assert.equal(view.vaccinePayment(base), '费用未填写')
const siblings = [
  { ...base, id: 'prior', doseNumber: 1 },
  { ...base, id: 'other-series', seriesId: 's2' },
  { ...base, id: 'other-child', childId: 'child-b' },
  { ...base, id: 'other-family', familyId: 'family-b' },
]
const series = view.vaccineSeries(siblings, base)
assert.deepEqual(Array.from(series, (v) => v.id), ['prior', 'a'])
assert.deepEqual(Array.from(view.vaccineSeries(siblings, { ...base, seriesId: undefined, catalogId: undefined }), (v) => v.id), ['a'])
assert.equal(view.vaccineError(new Error('PREVIOUS_DOSE_NOT_COMPLETED')), '请先完成前序剂次的接种记录')
assert.match(view.vaccineError(new Error('VACCINE_INTERVAL_INVALID')), /间隔/)
assert.match(view.vaccineError(new Error('VACCINE_COMPLETED_DATE_INVALID')), /早于/)
assert.match(view.vaccineError(new Error('FORBIDDEN')), /权限/)

async function testPagination() {
  let authorized = true, requests = 0, calls = []
  const data = Array.from({ length: 205 }, (_, i) => ({ _id: `v-${i}`, familyId: 'family-a', childId: 'child-a' }))
  const handler = load('cloud/functions/listVaccines/index.ts', { '../../shared/db': {
    context: () => 'trusted-openid',
    activeMember: async (familyId, openid) => {
      assert.equal(familyId, 'family-a'); assert.equal(openid, 'trusted-openid')
      if (!authorized) throw new Error('FORBIDDEN')
    },
    result: (data) => ({ ok: true, data }),
    db: { collection: (name) => {
      assert.equal(name, 'vaccines')
      let skip = 0, size = 0
      const q = {
        where: (where) => { assert.equal(where.familyId, 'family-a'); assert.equal(where.childId, 'child-a'); return q },
        orderBy: () => q,
        skip: (value) => { skip = value; return q },
        limit: (value) => { size = value; return q },
        get: async () => { requests++; calls.push(skip); return { data: data.slice(skip, skip + size) } },
      }
      return q
    } },
  } }).main
  const result = await handler({ familyId: 'family-a', childId: 'child-a' })
  assert.equal(result.data.length, 205)
  assert.equal(result.data[204].id, 'v-204')
  assert.equal(requests, 3)
  assert.deepEqual(calls, [0, 100, 200])
  authorized = false
  await assert.rejects(handler({ familyId: 'family-a', childId: 'child-a' }), /FORBIDDEN/)
}
testPagination().then(() => console.log('PASS: vaccine status/day boundaries, scoped dose selection, unknown payment, actionable errors, full pagination and trusted family authorization')).catch((error) => { console.error(error); process.exitCode = 1 })
