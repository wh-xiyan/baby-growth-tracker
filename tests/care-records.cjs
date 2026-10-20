const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, dependencies = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Missing test dependency ${name}`)
    return dependencies[name]
  } })
  return exports
}
const home = load('src/utils/home.ts')
const care = load('src/utils/care-records.ts', { './home': home })
const record = (id, category, occurredAt, metrics = {}) => ({ id, category, occurredAt, metrics })
const records = [
  record('new-solid', 'feeding', '2026-10-20T10:00:00+08:00', { feedingType: 'solid_food', amount: 100, unit: 'g' }),
  record('old-solid', 'solid_food', '2026-10-20T09:00:00+08:00', { amount: 80, unit: 'g' }),
  record('formula', 'feeding', '2026-10-19T17:00:00Z', { feedingType: 'formula', amount: 120, unit: 'ml' }),
  record('breast', 'feeding', '2026-10-19T12:00:00Z', { feedingType: 'breastfeeding', durationMinutes: 15, side: 'left' }),
  record('sleep', 'sleep', '2026-10-19T06:00:00Z', { sleepDurationMinutes: 90 }),
  record('growth', 'measurement', '2026-10-19T06:00:00Z', { height: 80 }),
]
assert.equal(care.validRange('2026-10-14', '2026-10-20', '2026-10-20'), true)
assert.equal(care.validRange('2026-02-30', '2026-03-01', '2026-10-20'), false)
assert.equal(care.validRange('2026-10-20', '2026-10-19', '2026-10-20'), false)
assert.equal(care.validRange('2026-10-20', '2026-10-21', '2026-10-20'), false)
assert.equal(care.shiftDate('2026-03-01', -1), '2026-02-28')
const feeds = care.filterCare(records, 'feeding', 'all')
assert.equal(feeds.length, 4)
assert.equal(care.filterCare(records, 'feeding', 'solid_food').length, 2)
assert.equal(care.filterCare(records, 'all', 'all').length, 5)
const groups = care.groupCare(care.filterCare(records, 'all', 'all'))
assert.equal(groups[0][0], '2026-10-20')
assert.equal(groups[0][1].length, 3)
assert.equal(care.careMetrics(feeds, 'feeding')[1].value, '120 ml')
assert.equal(care.careMetrics(feeds, 'feeding')[2].value, '2次')
const translated = care.detailMetrics(records[3])
assert.equal(translated.find((f) => f.label === '喂养方式').value, '母乳')
assert.equal(translated.find((f) => f.label === '哺乳侧别').value, '左侧')
assert.equal(care.careTitle(records[1]), '辅食')
assert.equal(care.careMetrics([], 'sleep')[1].value, '0分钟')

// Exercise the real date-group component with a minimal hook/JSX harness.
let hookState, navigation
const Timeline = load('src/pages/record-list/components/Timeline.tsx', {
  '@tarojs/components': { Button: 'Button', Text: 'Text', View: 'View' },
  react: { useState: (initial) => {
    if (!hookState) hookState = initial
    return [hookState, (value) => { hookState = value }]
  } },
  'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) },
  '@tarojs/taro': { default: { navigateTo: (options) => { navigation = options.url } } },
  '../../../utils/care-records': care,
  '../../../utils/home': home,
}).Timeline
const treeNodes = (tree) => {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(treeNodes)
  return [tree, ...treeNodes(tree.props?.children)]
}
const renderGroups = (key = 'range-all') => treeNodes(Timeline({ records: care.filterCare(records, 'all', 'all'), queryKey: key, category: 'all' }))
let tree = renderGroups()
const rowsIn = (nodes) => nodes.filter((n) => n.props?.className === 'care-record-row')
assert.equal(rowsIn(tree).length, 3)
tree.filter((n) => n.props?.className === 'care-date-heading')[1].props.onClick()
tree = renderGroups(); assert.equal(rowsIn(tree).length, 5)
rowsIn(tree)[0].props.onClick(); assert.match(navigation, /record-detail/)
assert.equal(rowsIn(renderGroups()).length, 5) // returning does not reset expansion
renderGroups().find((n) => n.type === 'Button' && n.props.children === '全部收起').props.onClick()
assert.equal(rowsIn(renderGroups()).length, 0)
renderGroups().find((n) => n.type === 'Button' && n.props.children === '全部展开').props.onClick()
assert.equal(rowsIn(renderGroups()).length, 5)
assert.equal(rowsIn(renderGroups('different-filter')).length, 3)

// Each date header must use the selected tab's statistics, not the all-category template.
for (const [category, expected, forbidden] of [
  ['feeding', '已记录配方奶量', '记录累计睡眠'],
  ['sleep', '睡眠段数', '喂养次数'],
  ['diaper', '排便次数', '喂养次数'],
  ['health', '健康记录', '记录累计睡眠'],
]) {
  const sample = category === 'diaper' || category === 'health'
    ? [record(category, category, '2026-10-20T09:00:00+08:00')]
    : care.filterCare(records, category, 'all')
  const nodes = treeNodes(Timeline({ records: sample, queryKey: category, category }))
  const captions = nodes.filter((n) => n.props?.className === 'care-date-brief')
  assert.ok(captions.length)
  for (const caption of captions) {
    assert.ok(caption.props.children.includes(expected))
    assert.ok(!caption.props.children.includes(forbidden))
  }
}

const range = load('cloud/shared/record-range.ts', { './home': { localDate: () => '2026-10-20' } })
assert.equal(range.queryRange({ date: '2026-10-20' }).start.toISOString(), '2026-10-19T16:00:00.000Z')
assert.equal(range.queryRange({ startDate: '2026-10-14', endDate: '2026-10-20' }).end.toISOString(), '2026-10-20T16:00:00.000Z')
assert.throws(() => range.queryRange({ date: '2026-02-30' }), /INVALID_DAILY_RECORD_QUERY/)
assert.throws(() => range.queryRange({ startDate: '2026-10-21', endDate: '2026-10-20' }), /INVALID_DAILY_RECORD_QUERY/)

async function testCloud() {
  let authorized = true
  const command = {
    exists: (value) => ({ exists: value }), in: (value) => ({ in: value }),
    gte: (from) => ({ from, and: (to) => ({ from, ...to }) }),
    lt: (to) => ({ to }), lte: (to) => ({ to }),
  }
  const rows = Array.from({ length: 205 }, (_, i) => ({ _id: `date-${i}`, familyId: 'family-a', childId: 'child-a', category: 'feeding', createdBy: 'member-a', occurredAt: new Date('2026-10-20T02:00:00Z') }))
  const strings = [{ _id: 'legacy-string', category: 'solid_food', createdBy: 'member-a', occurredAt: '2026-10-14T00:00:00Z' }]
  let pages = 0
  const db = { command, collection: (collection) => {
    let where, skip = 0, limit = 100
    const chain = {
      where: (value) => { where = value; return chain },
      orderBy: () => chain,
      skip: (value) => { skip = value; return chain },
      limit: (value) => { limit = value; return chain },
      get: async () => {
        assert.equal(where.familyId, 'family-a')
        if (collection === 'family_members') return { data: [{ userId: 'member-a', displayName: '妈妈' }] }
        assert.equal(where.childId, 'child-a')
        assert.equal(where.deletedAt.exists, false)
        assert.deepEqual(Array.from(where.category.in), ['feeding', 'solid_food'])
        const isString = typeof where.occurredAt.from === 'string'
        assert.equal(new Date(where.occurredAt.from).toISOString(), '2026-10-13T16:00:00.000Z')
        pages++
        return { data: (isString ? strings : rows).slice(skip, skip + limit) }
      },
    }
    return chain
  } }
  const shared = { db, context: () => 'server-openid', activeMember: async (family, openid) => {
    assert.equal(family, 'family-a'); assert.equal(openid, 'server-openid')
    if (!authorized) throw new Error('FORBIDDEN')
  }, result: (data) => ({ ok: true, data }) }
  const authors = load('cloud/shared/record-authors.ts', { './db': shared })
  const handler = load('cloud/functions/listDailyRecords/index.ts', {
    '../../shared/db': shared, '../../shared/record-range': range, '../../shared/record-authors': authors,
  }).main
  const input = { familyId: 'family-a', childId: 'child-a', category: 'feeding', startDate: '2026-10-14', endDate: '2026-10-20' }
  const response = await handler(input)
  assert.equal(response.data.length, 206)
  assert.equal(pages, 4)
  assert.equal(response.data[0].authorName, '妈妈')
  assert.equal(response.data[205].id, 'date-204')
  authorized = false
  await assert.rejects(handler(input), /FORBIDDEN/)
}
testCloud().then(() => console.log('PASS: range validation, Shanghai boundaries, grouping, subtype/unit separation, Chinese detail fields, paginated mixed Date/string queries and family authorization')).catch((error) => { console.error(error); process.exitCode = 1 })
