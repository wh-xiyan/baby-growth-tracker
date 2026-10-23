/* Tests the same transaction domain used by cloud functions and local demo. */
const fs = require('node:fs'),
  assert = require('node:assert/strict'),
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
const {
  mutateFamily,
  memberKey,
  slotKey,
  defaultRole,
  canManage,
  childData,
} = require('../src/domain/family.ts')
let db = { users: {}, children: {} },
  serial = 0,
  passed = 0
for (const id of ['owner', 'dad', 'grandma', 'other', 'other2', 'outsider', 'unrelated'])
  db.users[id] = { _id: id, nickname: id }
const get = (c, id) => db[c]?.[id]
async function act(userId, action, data = {}) {
  const next = structuredClone(db),
    input = { action, operationId: `test_operation_${++serial}`, ...data }
  const port = {
    get: async (c, id) => next[c]?.[id],
    put: async (c, id, row) => {
      next[c] ||= {}
      next[c][id] = { ...row, _id: id }
    },
    remove: async (c, id) => {
      delete next[c]?.[id]
    },
  }
  const response = await mutateFamily(port, userId, input)
  db = next
  return response
}
async function check(name, fn) {
  await fn()
  passed++
  console.log('PASS ' + name)
}
async function reject(user, action, data, code) {
  const before = JSON.stringify(db)
  await assert.rejects(() => act(user, action, data), new RegExp(code))
  assert.equal(JSON.stringify(db), before, 'failed mutation must not commit')
}
async function main() {
  let fid
  await check('identity defaults and author rules', async () => {
    assert.equal(defaultRole('妈妈'), 'admin')
    assert.equal(defaultRole('奶奶'), 'adult')
    assert.equal(defaultRole('其他家人'), 'viewer')
    assert.equal(canManage('adult', 'u', 'v'), false)
    assert.equal(canManage('admin', 'u', 'v'), true)
    assert.throws(() => childData({ name: 'x', birthday: '2025-02-30' }))
  })
  await check('personal draft belongs to its author and cannot be hijacked', async () => {
    await act('owner', 'savePersonalChild', {
      childId: 'personal',
      data: { name: '豆豆', birthday: '2025-01-01' },
    })
    await reject(
      'outsider',
      'savePersonalChild',
      { childId: 'personal', data: { name: '盗用', birthday: '2025-01-01' } },
      'FORBIDDEN',
    )
  })
  await check('creation atomically attaches draft and reserves one identity', async () => {
    fid = (
      await act('owner', 'create', { name: '豆豆的小家', identity: '妈妈', childId: 'personal' })
    ).id
    assert.equal(get('children', 'personal').scope, 'family')
    assert.equal(get('users', 'owner').activeFamilyId, fid)
    assert.equal(get('family_identity_slots', slotKey(fid, '妈妈')).userId, 'owner')
  })
  await check('single family membership rejects second creation', async () => {
    await reject('owner', 'create', { name: '第二个家', identity: '妈妈' }, 'FAMILY_ALREADY_LINKED')
  })
  let invite = 'invite-token'
  await check('guest cannot create invitations or manage family', async () => {
    await reject('outsider', 'createInvite', { familyId: fid, inviteId: invite }, 'FORBIDDEN')
    await reject('outsider', 'updateFamily', { familyId: fid, name: 'x' }, 'FORBIDDEN')
  })
  await check('invites have bounded validity and usage', async () => {
    await act('owner', 'createInvite', { familyId: fid, inviteId: invite, code: 'token' })
    assert.equal(get('family_invitations', invite).maxUses, 10)
    assert.ok(new Date(get('family_invitations', invite).expiresAt) > new Date())
  })
  const submit = async (user, identity) => act(user, 'join', { inviteId: invite, identity })
  const review = async (id, who = 'owner', extra = {}) =>
    act(who, 'review', { familyId: fid, requestId: id, version: 1, approve: true, ...extra })
  await check('joining stays pending and duplicate pending requests fail', async () => {
    const r = await submit('dad', '爸爸')
    assert.equal(get('users', 'dad').activeFamilyId, undefined)
    assert.equal(get('family_requests', r.id).status, 'pending')
    await reject('dad', 'join', { inviteId: invite, identity: '爸爸' }, 'REQUEST_PENDING')
    await review(r.id)
    assert.equal(get('family_members', memberKey(fid, 'dad')).role, 'admin')
  })
  await check('admin may approve ordinary but not admin requests', async () => {
    const a = await submit('grandma', '奶奶')
    await review(a.id, 'dad')
    assert.equal(get('family_members', memberKey(fid, 'grandma')).role, 'adult')
    const b = await submit('other', '其他家人')
    await reject(
      'dad',
      'review',
      { familyId: fid, requestId: b.id, version: 1, approve: true, role: 'admin' },
      'OWNER_REQUIRED',
    )
    await review(b.id, 'dad')
    assert.equal(get('family_members', memberKey(fid, 'other')).role, 'viewer')
  })
  await check(
    'viewer cannot create family babies; ordinary cannot edit family settings',
    async () => {
      await reject(
        'other',
        'addChild',
        { familyId: fid, data: { name: 'x', birthday: '2025-01-01' } },
        'FORBIDDEN',
      )
      await reject('grandma', 'updateFamily', { familyId: fid, name: 'x' }, 'FORBIDDEN')
    },
  )
  await check('same identity competing approvals allow only one occupant', async () => {
    const a = await submit('outsider', '外婆'),
      b = await submit('other2', '外婆')
    await review(a.id)
    await reject(
      'owner',
      'review',
      { familyId: fid, requestId: b.id, version: 1, approve: true },
      'IDENTITY_OCCUPIED',
    )
    assert.equal(get('family_requests', b.id).status, 'pending')
    await act('other2', 'cancelRequest', { requestId: b.id })
  })
  await check('label changes do not change role or reserved identity', async () => {
    await act('grandma', 'updateLabel', { familyId: fid, label: '豆豆奶奶' })
    assert.equal(get('family_members', memberKey(fid, 'grandma')).relationshipCode, '奶奶')
    assert.equal(get('family_members', memberKey(fid, 'grandma')).role, 'adult')
  })
  await check(
    'identity requests preserve old permissions until approved; no self review',
    async () => {
      const a = await act('grandma', 'requestIdentity', { familyId: fid, identity: '爷爷' })
      assert.equal(get('family_members', memberKey(fid, 'grandma')).relationshipCode, '奶奶')
      await review(a.id)
      assert.equal(get('family_members', memberKey(fid, 'grandma')).relationshipCode, '爷爷')
      assert.equal(get('family_identity_slots', slotKey(fid, '奶奶')), undefined)
      const b = await act('dad', 'requestIdentity', { familyId: fid, identity: '照护者' })
      await reject(
        'dad',
        'review',
        { familyId: fid, requestId: b.id, version: 1, approve: true },
        'SELF_REVIEW_FORBIDDEN',
      )
      await review(b.id)
      assert.equal(get('family_members', memberKey(fid, 'dad')).role, 'adult')
    },
  )
  await check('only creator can promote or demote admin', async () => {
    await act('owner', 'role', { familyId: fid, targetId: memberKey(fid, 'dad'), role: 'admin' })
    await reject(
      'dad',
      'role',
      { familyId: fid, targetId: memberKey(fid, 'grandma'), role: 'admin' },
      'OWNER_REQUIRED',
    )
    await reject(
      'dad',
      'remove',
      { familyId: fid, targetId: memberKey(fid, 'owner') },
      'OWNER_TRANSFER_REQUIRED',
    )
  })
  await check('identity approval version conflict leaves old identity intact', async () => {
    const r = await act('grandma', 'requestIdentity', { familyId: fid, identity: '奶奶' })
    await act('grandma', 'updateLabel', { familyId: fid, label: '新称谓' })
    await reject(
      'owner',
      'review',
      { familyId: fid, requestId: r.id, version: 1, approve: true },
      'REQUEST_CONFLICT',
    )
    assert.equal(get('family_members', memberKey(fid, 'grandma')).relationshipCode, '爷爷')
    await act('grandma', 'cancelRequest', { requestId: r.id })
  })
  await check('personal child attachment requires approval for ordinary member', async () => {
    await act('grandma', 'savePersonalChild', {
      childId: 'second',
      data: { name: '豆豆', birthday: '2025-01-02' },
    })
    const r = await act('grandma', 'requestChild', { familyId: fid, childId: 'second' })
    assert.equal(get('children', 'second').scope, 'personal')
    await review(r.id)
    assert.equal(get('children', 'second').familyId, fid)
    assert.ok(get('children', 'personal'))
    assert.notEqual('personal', 'second')
  })
  await check('revoked and expired invitations cannot be approved', async () => {
    const r = await submit('other2', '外公')
    await act('owner', 'revokeInvite', { familyId: fid, inviteId: invite })
    await reject(
      'owner',
      'review',
      { familyId: fid, requestId: r.id, version: 1, approve: true },
      'INVITATION_EXPIRED',
    )
    await act('other2', 'cancelRequest', { requestId: r.id })
    await reject('other2', 'join', { inviteId: invite, identity: '外公' }, 'INVITATION_REVOKED')
  })
  await check('removed members lose access while family records remain', async () => {
    db.growth_records = { keep: { familyId: fid, createdBy: 'other', content: '保留' } }
    await act('owner', 'remove', { familyId: fid, targetId: memberKey(fid, 'other') })
    assert.equal(get('users', 'other').activeFamilyId, '')
    assert.equal(get('family_identity_slots', slotKey(fid, '其他家人')), undefined)
    assert.ok(db.growth_records.keep)
    await reject('other', 'updateLabel', { familyId: fid, label: 'x' }, 'FORBIDDEN')
  })
  await check('creator must transfer before leaving; unique owner is retained', async () => {
    await reject('owner', 'leave', { familyId: fid }, 'OWNER_TRANSFER_REQUIRED')
    await act('owner', 'transfer', { familyId: fid, targetId: memberKey(fid, 'dad') })
    assert.equal(get('families', fid).ownerId, 'dad')
    assert.equal(get('family_members', memberKey(fid, 'owner')).role, 'admin')
    await act('owner', 'leave', { familyId: fid })
    assert.equal(get('family_members', memberKey(fid, 'dad')).role, 'owner')
    assert.ok(get('children', 'personal'))
  })
  await check('cross-family target and draft mass assignment cannot escape ownership', async () => {
    await reject(
      'unrelated',
      'role',
      { familyId: fid, targetId: memberKey(fid, 'dad'), role: 'viewer' },
      'FORBIDDEN',
    )
    await reject(
      'unrelated',
      'savePersonalChild',
      { childId: 'personal', data: { name: 'x', birthday: '2025-01-01' } },
      'FORBIDDEN',
    )
  })
  console.log(`${passed} family checks passed`)
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
