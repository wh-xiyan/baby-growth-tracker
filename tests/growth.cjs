/* Run with node tests/growth.cjs. Uses the project's TypeScript compiler and an in-memory SDK. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
require.extensions['.ts'] = (mod, name) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(name, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: name,
    }).outputText,
    name,
  )
const storage = new Map(),
  rows = {
    users: [{ _id: 'u1', openid: 'trusted-openid' }],
    family_members: [
      { familyId: 'f', userId: 'u1', role: 'adult', status: 'active', displayName: '妈妈' },
    ],
    children: [{ _id: 'c', familyId: 'f', birthday: '2025-01-01' }],
    growth_records: [],
    media_assets: [],
  }
const command = {
  exists: (v) => ({ op: 'exists', value: v }),
  in: (v) => ({ op: 'in', value: v }),
  lt: (v) => ({ op: 'lt', value: v }),
}
function matches(r, where) {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && v.op) {
      if (v.op === 'exists') return (r[k] !== undefined) === v.value
      if (v.op === 'in') return Array.isArray(r[k]) ? r[k].some((item) => v.value.includes(item)) : v.value.includes(r[k])
      if (v.op === 'lt') return r[k] < v.value
    }
    return r[k] === v
  })
}
function collection(name) {
  let where = {},
    sort = [],
    limit = Infinity
  const query = {
    where(v) {
      where = v
      return query
    },
    doc(id) {
      where = { _id: id }
      return {
        ...query,
        get: async () => ({
          data: rows[name].find((r) => matches(r, where))
            ? { ...rows[name].find((r) => matches(r, where)) }
            : undefined,
        }),
      }
    },
    orderBy(k, d) {
      sort.push([k, d])
      return query
    },
    limit(n) {
      limit = n
      return query
    },
    async get() {
      let data = rows[name].filter((r) => matches(r, where))
      data.sort((a, b) => {
        for (const [k, d] of sort) {
          if (a[k] !== b[k]) return (a[k] < b[k] ? -1 : 1) * (d === 'desc' ? -1 : 1)
        }
        return 0
      })
      return { data: data.slice(0, limit).map((r) => ({ ...r })) }
    },
    async add({ data }) {
      const id = 'created-' + rows[name].length
      rows[name].push({ ...data, _id: id })
      return { _id: id }
    },
    async update({ data }) {
      let updated = 0
      for (const r of rows[name])
        if (matches(r, where)) {
          Object.assign(r, data)
          updated++
        }
      return { stats: { updated } }
    },
  }
  return query
}
const cloud = {
  deleteFile: async ({ fileList }) => ({ fileList: fileList.map((fileID) => ({ fileID, status: 0 })) }),
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  getWXContext: () => ({ OPENID: 'trusted-openid' }),
  database: () => ({ command, collection }),
}
const taro = {
  getStorageSync: (k) => storage.get(k),
  setStorageSync: (k, v) => storage.set(k, v),
  removeStorageSync: (k) => storage.delete(k),
}
const originalLoad = Module._load
Module._load = function (name, ...args) {
  if (name === 'wx-server-sdk') return cloud
  if (name === '@tarojs/taro') return taro
  return originalLoad.call(this, name, ...args)
}
global.CLOUD_ENV_ID = ''
const growth = require('../src/utils/growth.ts'),
  shared = require('../cloud/shared/growth.ts'),
  { validateRecord } = require('../cloud/shared/records.ts')
const session = require('../src/stores/session.ts').useSessionStore
const service = require('../src/services/growth.ts')
const update = require('../cloud/functions/updateRecord/index.ts').main,
  remove = require('../cloud/functions/deleteRecord/index.ts').main
const create = require('../cloud/functions/createRecord/index.ts').main,
  list = require('../cloud/functions/listGrowthRecords/index.ts').main
const updateChild = require('../cloud/functions/updateChild/index.ts').main
let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log('PASS', name)
}
async function asyncCheck(name, fn) {
  await fn()
  passed++
  console.log('PASS', name)
}
const child = { id: 'c', familyId: 'f', birthday: '2025-01-01', gender: 'male' }
const record = (metric, value, date = '2026-01-01', method = 'lying') => ({
  id: 'r',
  category: 'measurement',
  occurredAt: date + 'T09:00:00+08:00',
  metrics: { [metric]: value, measurementMethod: method },
})
check('official table provenance and all 234 original rows', () => {
  const standard = require('../src/data/growth-standard.json'),
    source = fs.readFileSync(path.join(root, 'prototypes/growth/reference-data.js'), 'utf8')
  const prototype = JSON.parse(source.slice(source.indexOf('{')).replace(/;\s*$/, ''))
  assert.deepEqual(standard, prototype)
  assert.equal(
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(root, 'prototypes/growth/reference-standard.pdf')))
      .digest('hex'),
    standard.sha256,
  )
  let count = 0
  for (const sex of ['male', 'female'])
    for (const metric of growth.growthMetrics) {
      const data = standard.data[sex][metric]
      count += data.length
      data.forEach((r, i) => {
        assert.equal(r.length, 8)
        if (i) assert(r[0] > data[i - 1][0])
        for (let j = 2; j < 8; j++) assert(r[j] > r[j - 1])
      })
    }
  assert.equal(count, 234)
  assert.equal(standard.data.male.height.find((r) => r[0] === 12)[4], 76.7)
  assert.equal(standard.data.female.weight.find((r) => r[0] === 24)[4], 11.9)
})
check('calendar age handles month ends, leap birthdays and invalid dates', () => {
  assert.equal(growth.growthAge('2024-01-31', '2024-02-29').whole, 1)
  assert.equal(growth.growthAge('2024-01-31', '2024-02-28').whole, 0)
  assert.equal(growth.growthAge('2024-02-29', '2025-02-28').whole, 12)
  assert.equal(growth.growthAge('2025-02-30', '2026-01-01'), undefined)
  assert.equal(growth.growthAge('2025-01-01', '2024-12-31'), undefined)
})
check('reference sex, P50 and bounded ranges use original table rows', () => {
  assert.equal(growth.compareGrowth(record('height', 76.7), child, 'height').position, '位于 P50')
  assert.match(growth.compareGrowth(record('height', 76), child, 'height').position, /P25—P50/)
  assert.equal(
    growth.compareGrowth(record('weight', 9.4), { ...child, gender: 'female' }, 'weight').position,
    '位于 P50',
  )
  assert(
    growth.compareGrowth(record('height', 76.7), { ...child, gender: 'unknown' }, 'height').reason,
  )
  assert(
    growth.compareGrowth(record('height', 76.7, '2026-01-01', 'standing'), child, 'height').reason,
  )
  assert.equal(
    growth.compareGrowth(record('height', 88.2, '2027-01-01', 'standing'), child, 'height')
      .position,
    '位于 P50',
  )
  assert(
    growth
      .compareGrowth(record('weight', 13, '2027-02-01'), child, 'weight')
      .reason.includes('未列出'),
  )
  assert(
    growth
      .compareGrowth(record('weight', 20, '2032-01-01'), child, 'weight')
      .reason.includes('7周岁'),
  )
  assert(
    growth.compareGrowth(
      record('headCircumference', 49.3, '2028-01-02'),
      child,
      'headCircumference',
    ).reason,
  )
  assert.equal(
    growth.compareGrowth(
      record('headCircumference', 49.3, '2028-01-01'),
      child,
      'headCircumference',
    ).position,
    '位于 P50',
  )
})
const payload = {
  category: 'measurement',
  title: '身体测量',
  occurredAt: '2026-01-01T09:00:00+08:00',
  metrics: { headCircumference: 46 },
  mediaFileIds: [],
}
check('head-only measurements, strict numbers, methods, and mixed media cap', () => {
  assert.equal(validateRecord(payload).metrics.headCircumference, 46)
  for (const bad of [0, -1, NaN, Infinity, '46'])
    assert.throws(() => validateRecord({ ...payload, metrics: { headCircumference: bad } }))
  assert.throws(() => validateRecord({ ...payload, metrics: { height: 80 } }), /METHOD_REQUIRED/)
  assert.equal(
    validateRecord({
      ...payload,
      category: 'milestone',
      mediaFileIds: Array.from({ length: 10 }, (_, i) => 'f' + i),
    }).mediaFileIds.length,
    10,
  )
  assert.throws(
    () =>
      validateRecord({
        ...payload,
        category: 'milestone',
        mediaFileIds: Array.from({ length: 11 }, (_, i) => 'f' + i),
      }),
    /INVALID_MEDIA/,
  )
  assert.throws(() => validateRecord({ ...payload, mediaFileIds: ['a', 'a'] }), /INVALID_MEDIA/)
})
check('same-time ID cursor is stable; legacy head-only measurements stay out of events', () => {
  const all = ['a', 'Z', 'A', 'z', 'b'].map((id) => ({
    id,
    category: 'milestone',
    occurredAt: '2026-01-01T01:00:00.000Z',
  }))
  all.push({
    id: 'legacy',
    category: 'milestone',
    occurredAt: all[0].occurredAt,
    metrics: { headCircumference: 46 },
  })
  const seen = []
  let cursor
  do {
    const page = shared.selectGrowthPage(all, { workspace: 'events', limit: 2, cursor })
    seen.push(...page.items.map((r) => r.id))
    cursor = page.nextCursor
  } while (cursor)
  assert.equal(seen.length, 5)
  assert.equal(new Set(seen).size, 5)
  assert(!seen.includes('legacy'))
  assert.equal(shared.selectGrowthPage(all, { workspace: 'measurement' }).items[0].id, 'legacy')
})
check('role matrix forbids viewer writes and other-member edits', () => {
  for (const [role, author, ok] of [
    ['owner', 'other', true],
    ['adult', 'u1', true],
    ['adult', 'other', false],
    ['viewer', 'u1', false],
  ]) {
    assert.equal(growth.canManageRecord(role, 'u1', { createdBy: author }), ok)
    if (ok) shared.assertRecordManager({ role, userId: 'u1' }, { createdBy: author })
    else
      assert.throws(
        () => shared.assertRecordManager({ role, userId: 'u1' }, { createdBy: author }),
        /FORBIDDEN/,
      )
  }
})
async function main() {
  await asyncCheck(
    'cloud writes use trusted member role and optimistic atomic versions',
    async () => {
      const r = {
        ...payload,
        _id: 'edit',
        familyId: 'f',
        childId: 'c',
        createdBy: 'other',
        version: 0,
      }
      rows.growth_records = [r]
      await assert.rejects(
        () =>
          update({
            familyId: 'f',
            recordId: 'edit',
            expectedVersion: 0,
            data: { content: 'x' },
            role: 'owner',
          }),
        /FORBIDDEN/,
      )
      await assert.rejects(
        () => remove({ familyId: 'f', recordId: 'edit', expectedVersion: 0 }),
        /FORBIDDEN/,
      )
      rows.family_members[0].role = 'owner'
      const result = await Promise.allSettled([
        update({ familyId: 'f', recordId: 'edit', expectedVersion: 0, data: { content: 'first' } }),
        update({
          familyId: 'f',
          recordId: 'edit',
          expectedVersion: 0,
          data: { content: 'second' },
        }),
      ])
      assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1)
      assert.equal(r.version, 1)
      assert.equal(r.createdBy, 'other')
      await assert.rejects(
        () => remove({ familyId: 'f', recordId: 'edit', expectedVersion: 0 }),
        /CONFLICT/,
      )
      await remove({ familyId: 'f', recordId: 'edit', expectedVersion: 1 })
      assert(r.deletedAt)
      assert.equal(r.version, 2)
    },
  )
  await asyncCheck(
    'cloud rejects future/before-birth dates and accepts ten mixed attachments',
    async () => {
      rows.media_assets = Array.from({ length: 10 }, (_, i) => ({
        _id: 'asset' + i,
        familyId: 'f',
        childId: 'c',
        fileId: 'file' + i,
        fileType: i % 2 ? 'video' : 'image',
      }))
      const input = {
        ...payload,
        familyId: 'f',
        childId: 'c',
        category: 'study',
        title: '认识了颜色',
        mediaFileIds: rows.media_assets.map((r) => r.fileId),
      }
      const saved = await create(input)
      assert(rows.growth_records.find((r) => r._id === saved.data.id).mediaFileIds.length === 10)
      await assert.rejects(
        () => create({ ...input, occurredAt: '2099-01-01T09:00:00+08:00' }),
        /INVALID_GROWTH_DATE/,
      )
      await assert.rejects(
        () => create({ ...input, occurredAt: '2024-12-31T09:00:00+08:00' }),
        /INVALID_GROWTH_DATE/,
      )
      await assert.rejects(() => create({ ...input, mediaFileIds: ['foreign-file'] }), /OWNERSHIP/)
    },
  )
  await asyncCheck(
    'cloud paginates past 100, merges Date/string timestamps and isolates families',
    async () => {
      rows.growth_records = Array.from({ length: 135 }, (_, i) => ({
        _id: 'event-' + String(i).padStart(3, '0'),
        familyId: 'f',
        childId: 'c',
        category: i % 2 ? 'study' : 'milestone',
        title: 'event',
        createdBy: 'u1',
        occurredAt: i % 2 ? new Date('2026-01-01T01:00:00Z') : '2026-01-01T01:00:00.000Z',
      }))
      rows.growth_records.push({
        _id: 'foreign',
        familyId: 'other',
        childId: 'c',
        category: 'milestone',
        occurredAt: new Date('2026-01-01'),
      })
      rows.family_members[0].role = 'viewer'
      const seen = []
      let cursor
      do {
        const page = (
          await list({ familyId: 'f', childId: 'c', workspace: 'events', limit: 20, cursor })
        ).data
        seen.push(...page.items.map((r) => r.id))
        cursor = page.nextCursor
      } while (cursor)
      assert.equal(seen.length, 135)
      assert.equal(new Set(seen).size, 135)
      assert(!seen.includes('foreign'))
      await assert.rejects(
        () => list({ familyId: 'other', childId: 'c', workspace: 'events' }),
        /FORBIDDEN/,
      )
    },
  )
  await asyncCheck(
    'local demo edits, deletes, versions and refresh flags mirror permissions',
    async () => {
      session.setState({
        userId: 'u1',
        familyId: 'f',
        childId: 'c',
        currentRole: 'adult',
        user: { nickname: '妈妈' },
      })
      const r = {
        ...payload,
        id: 'demo',
        familyId: 'f',
        childId: 'c',
        createdBy: 'other',
        version: 0,
      }
      storage.set('baby-growth-demo-records', [r])
      await assert.rejects(() => service.saveGrowthRecord({ ...r, content: 'x' }, r), /FORBIDDEN/)
      session.setState({ currentRole: 'viewer' })
      await assert.rejects(() => service.saveGrowthRecord(r), /FORBIDDEN/)
      session.setState({ currentRole: 'owner' })
      await service.saveGrowthRecord({ ...r, content: 'edited' }, r)
      const saved = storage.get('baby-growth-demo-records')[0]
      assert.equal(saved.createdBy, 'other')
      assert.equal(saved.version, 1)
      await assert.rejects(
        () => service.saveGrowthRecord({ ...r, content: 'stale' }, r),
        /CONFLICT/,
      )
      await service.deleteGrowthRecord(saved)
      assert.equal(storage.get('baby-growth-demo-records').length, 0)
      assert.equal(storage.get('baby-growth-home-records-refresh'), true)
    },
  )
  await asyncCheck(
    'local measurement query reads all 150 and latest summary is independent of range',
    async () => {
      const all = Array.from({ length: 150 }, (_, i) => ({
        ...payload,
        id: 'm' + String(i).padStart(3, '0'),
        familyId: 'f',
        childId: 'c',
        occurredAt: '2026-01-01T01:00:00.000Z',
        metrics: { headCircumference: 45 + i / 100 },
      }))
      storage.set('baby-growth-demo-records', all)
      const page = await service.loadGrowthMeasurements({ familyId: 'f', childId: 'c' })
      assert.equal(page.items.length, 150)
      assert.equal(page.summary.headCircumference.length, 2)
      const empty = await service.listGrowthRecords({
        familyId: 'f',
        childId: 'c',
        workspace: 'measurement',
        startDate: '2026-02-01',
        endDate: '2026-03-01',
      })
      assert.equal(empty.items.length, 0)
      assert.equal(empty.summary.headCircumference.length, 2)
    },
  )
  await asyncCheck(
    'profile changes verify family ownership and reject mass-assignment fields',
    async () => {
      rows.family_members[0].role = 'owner'
      rows.children.push({ _id: 'other-child', familyId: 'other', birthday: '2025-01-01' })
      await assert.rejects(
        () => updateChild({ familyId: 'f', childId: 'other-child', data: { gender: 'female' } }),
        /NOT_FOUND/,
      )
      await assert.rejects(
        () => updateChild({ familyId: 'f', childId: 'c', data: { familyId: 'other' } }),
        /INVALID_CHILD/,
      )
      await updateChild({ familyId: 'f', childId: 'c', data: { gender: 'female' } })
      assert.equal(rows.children[0].gender, 'female')
    },
  )
  await asyncCheck('delete removes exclusive media, retains shared media and retries failed cleanup', async () => {
    rows.family_members[0].role = 'owner'
    rows.growth_records = [
      { _id: 'delete-media', familyId: 'f', childId: 'c', createdBy: 'u1', version: 1, mediaFileIds: ['cloud://exclusive', 'cloud://shared'] },
      { _id: 'keep-media', familyId: 'f', childId: 'c', createdBy: 'u1', mediaFileIds: ['cloud://shared'] },
    ]
    rows.media_assets = ['exclusive', 'shared'].map((id) => ({ _id: id, familyId: 'f', childId: 'c', fileId: 'cloud://' + id }))
    const deletedFiles = []
    const originalDelete = cloud.deleteFile
    let fail = true
    cloud.deleteFile = async ({ fileList }) => {
      if (fail) return { fileList: fileList.map((fileID) => ({ fileID, status: -1 })) }
      deletedFiles.push(...fileList)
      return { fileList: fileList.map((fileID) => ({ fileID, status: 0 })) }
    }
    const request = { familyId: 'f', recordId: 'delete-media', expectedVersion: 1 }
    assert.equal((await remove(request)).data.mediaCleanupPending, true)
    assert.ok(rows.growth_records[0].deletedAt)
    fail = false
    assert.equal((await remove(request)).data.mediaCleanupPending, false)
    assert.deepEqual(deletedFiles, ['cloud://exclusive'])
    assert.ok(rows.media_assets[0].deletedAt)
    assert.equal(rows.media_assets[1].deletedAt, undefined)
    cloud.deleteFile = originalDelete
  })
  await asyncCheck('native media return skips refresh once on its originating page only', async () => {
    const page = {}, otherPage = {}
    let current = page, onShow, refreshed = 0
    taro.getCurrentPages = () => [current]
    taro.useDidShow = (callback) => { onShow = callback }
    taro.previewMedia = async () => ({})
    const preview = require('../src/services/media-preview.ts')
    preview.usePageDidShow(() => { refreshed++ })
    await preview.previewMedia([{ url: 'a.jpg', type: 'image' }])
    current = otherPage
    onShow()
    assert.equal(refreshed, 1)
    current = page
    onShow()
    assert.equal(refreshed, 1)
    onShow()
    assert.equal(refreshed, 2)
    taro.previewMedia = async () => { throw new Error('cancel') }
    await assert.rejects(() => preview.previewMedia([{ url: 'a.mp4', type: 'video' }]))
    onShow()
    assert.equal(refreshed, 3)
  })
  console.log(`${passed} growth checks passed`)
}
main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    Module._load = originalLoad
  })
