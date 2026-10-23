/* Cloud entrypoint tests with a transactional in-memory wx-server-sdk. */
const fs = require('node:fs'),
  assert = require('node:assert/strict'),
  Module = require('node:module'),
  ts = require('typescript')
require.extensions['.ts'] = (m, p) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(p, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText,
    p,
  )
let data = {
    users: {
      u: { _id: 'u', openid: 'owner', nickname: '妈妈' },
      v: { _id: 'v', openid: 'applicant' },
      w: { _id: 'w', openid: 'guest' },
    },
  },
  openid = 'owner',
  queue = Promise.resolve()
const commands = {
  remove: () => ({ op: 'remove' }),
  gt: (v) => ({ op: 'gt', value: v }),
  exists: (v) => ({ op: 'exists', value: v }),
  in: (v) => ({ op: 'in', value: v }),
}
function matches(row, filter) {
  return Object.entries(filter).every(([k, v]) =>
    v?.op === 'gt'
      ? row[k] > v.value
      : v?.op === 'exists'
        ? (row[k] !== undefined) === v.value
        : v?.op === 'in'
          ? v.value.includes(row[k])
          : row[k] === v,
  )
}
function collection(store, name) {
  let filter = {},
    limit = 100
  const q = {
    where(f) {
      filter = f
      return q
    },
    limit(n) {
      limit = n
      return q
    },
    orderBy() {
      return q
    },
    async get() {
      return {
        data: Object.values(store[name] || {})
          .filter((r) => matches(r, filter))
          .sort((a, b) => a._id.localeCompare(b._id))
          .slice(0, limit),
      }
    },
    doc(id) {
      return {
        async get() {
          return { data: store[name]?.[id] }
        },
        async set({ data: row }) {
          store[name] ||= {}
          store[name][id] = { ...row, _id: id }
        },
        async update({ data: row }) {
          for (const [key, value] of Object.entries(row)) {
            if (value?.op === 'remove') delete store[name][id][key]
            else store[name][id][key] = value
          }
          return { stats: { updated: 1 } }
        },
        async remove() {
          delete store[name]?.[id]
        },
      }
    },
  }
  return q
}
const db = {
  command: commands,
  collection: (n) => collection(data, n),
  runTransaction: (fn) => {
    const run = queue.then(async () => {
      const copy = structuredClone(data),
        value = await fn({ collection: (n) => collection(copy, n) })
      data = copy
      return value
    })
    queue = run.catch(() => {})
    return run
  },
}
const original = Module._load
Module._load = function (name, ...args) {
  if (name === 'wx-server-sdk')
    return {
      init() {},
      DYNAMIC_CURRENT_ENV: 'x',
      database: () => db,
      getWXContext: () => ({ OPENID: openid }),
    }
  return original.call(this, name, ...args)
}
const main = require('../cloud/functions/familyAction/index.ts').main
let serial = 0
const call = (action, args = {}) =>
  main({ action, operationId: `operation_${++serial}_cloud`, ...args }).then((r) => r.data)
async function run() {
  const parallel = await Promise.allSettled([
    call('create', { name: '我们家', identity: '妈妈' }),
    call('create', { name: '第二个家', identity: '妈妈' }),
  ])
  assert.equal(parallel.filter((r) => r.status === 'fulfilled').length, 1)
  const fid = data.users.u.activeFamilyId
  assert.ok(fid)
  const idempotentEvent = {
    action: 'updateFamily',
    familyId: fid,
    name: '改名',
    operationId: 'stable_operation_123',
  }
  await main(idempotentEvent)
  const size = Object.keys(data.family_audit_logs).length
  await main(idempotentEvent)
  assert.equal(Object.keys(data.family_audit_logs).length, size)
  const invite = await call('createInvite', { familyId: fid })
  assert.ok(invite.code)
  assert.equal(
    JSON.stringify(data).includes(invite.code),
    false,
    'invitation plaintext must not persist',
  )
  openid = 'guest'
  const preview = await call('previewInvite', { code: invite.code })
  assert.deepEqual(Object.keys(preview).sort(), ['name', 'occupied'])
  const guest = await call('overview', { familyId: fid })
  assert.equal(guest.members.length, 0)
  await assert.rejects(
    () => call('updateFamily', { familyId: fid, name: 'hack', role: 'owner' }),
    /FORBIDDEN/,
  )
  openid = 'applicant'
  const request = await call('join', { code: invite.code, identity: '爸爸', role: 'owner' })
  assert.equal(data.users.v.activeFamilyId, undefined)
  openid = 'owner'
  await call('review', { familyId: fid, requestId: request.id, version: 1, approve: true })
  assert.equal(data.users.v.activeFamilyId, fid)
  assert.equal(data.family_members[`${fid}_v`].role, 'admin')
  openid = 'applicant'
  await assert.rejects(
    () => call('role', { familyId: fid, targetId: `${fid}_u`, role: 'viewer' }),
    /OWNER_TRANSFER_REQUIRED/,
  )
  const complete = require('../cloud/functions/completeVaccine/index.ts').main
  const manage = require('../cloud/functions/manageVaccineCompletion/index.ts').main
  const updatePlan = require('../cloud/functions/updateVaccine/index.ts').main
  openid = 'owner'
  await call('role', { familyId: fid, targetId: `${fid}_v`, role: 'adult' })
  data.vaccines = {
    p1: {
      _id: 'p1',
      familyId: fid,
      childId: 'baby',
      catalogId: 'catalog',
      doseNumber: 1,
      status: 'planned',
      createdBy: 'u',
      plannedDate: '2026-01-01',
    },
    p2: {
      _id: 'p2',
      familyId: fid,
      childId: 'baby',
      catalogId: 'catalog',
      doseNumber: 2,
      status: 'planned',
      createdBy: 'u',
    },
  }
  openid = 'applicant'
  await complete({ familyId: fid, vaccineId: 'p1', completedDate: '2026-01-01', note: '本人记录' })
  assert.equal(data.vaccine_completion_events.p1.createdBy, 'v')
  assert.equal(data.vaccines.p1.createdBy, 'u', 'plan author must remain unchanged')
  await assert.rejects(
    () => updatePlan({ familyId: fid, vaccineId: 'p1', data: { note: '篡改计划' } }),
    /FORBIDDEN/,
  )
  await manage({
    familyId: fid,
    vaccineId: 'p1',
    action: 'update',
    expectedVersion: 1,
    completedDate: '2026-01-01',
    note: '更正备注',
  })
  assert.equal(data.vaccines.p1.completedNote, '更正备注')
  await assert.rejects(
    () =>
      manage({
        familyId: fid,
        vaccineId: 'p1',
        action: 'update',
        expectedVersion: 1,
        completedDate: '2026-01-01',
      }),
    /RECORD_CONFLICT/,
  )
  openid = 'owner'
  await call('role', { familyId: fid, targetId: `${fid}_v`, role: 'viewer' })
  openid = 'applicant'
  await assert.rejects(
    () => manage({ familyId: fid, vaccineId: 'p1', action: 'delete', expectedVersion: 2 }),
    /FORBIDDEN/,
  )
  openid = 'owner'
  await manage({ familyId: fid, vaccineId: 'p1', action: 'delete', expectedVersion: 2 })
  assert.equal(data.vaccines.p1.status, 'planned')
  assert.ok(data.vaccine_completion_events.p1.deletedAt)
  console.log(
    'PASS vaccine event integration: independent author, plan restrictions, own event edits, optimistic version, viewer denial, administrator deletion',
  )
  console.log(
    'PASS cloud integration: concurrent single-family lock, idempotency, hashed invitation, guest privacy, forged role rejection, approval, creator protection',
  )
}
run()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => {
    Module._load = original
  })
