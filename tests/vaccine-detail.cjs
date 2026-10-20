const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(
  fs.readFileSync('cloud/functions/getVaccine/index.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText

function setup({ member = true, childId = 'child-a', familyId = 'family-a', deleted = false } = {}) {
  const document = { _id: 'vaccine-selected', familyId, childId, name: '当前这一针', deletedAt: deleted ? new Date() : undefined }
  const shared = { exports: {}, require: () => ({ db: { collection: () => ({ doc: () => ({ get: async () => ({ data: document }) }) }) } }) }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('cloud/shared/records.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, shared)
  const scope = {
    exports: {},
    require: (name) => name.endsWith('/db') ? {
      context: () => 'trusted-openid',
      activeMember: async (family, openid) => {
        assert.equal(family, 'family-a')
        assert.equal(openid, 'trusted-openid')
        if (!member) throw new Error('FORBIDDEN')
      },
      result: (data) => ({ ok: true, data }),
    } : { ownedDocument: shared.exports.ownedDocument },
  }
  vm.runInNewContext(source, scope)
  return scope.exports.main
}

async function run() {
  const input = { familyId: 'family-a', childId: 'child-a', vaccineId: 'vaccine-selected' }
  assert.equal((await setup()(input)).data.id, input.vaccineId)
  await assert.rejects(setup({ member: false })(input), /FORBIDDEN/)
  await assert.rejects(setup({ familyId: 'family-b' })(input), /NOT_FOUND/)
  await assert.rejects(setup({ childId: 'child-b' })(input), /NOT_FOUND/)
  await assert.rejects(setup({ deleted: true })(input), /NOT_FOUND/)
  await assert.rejects(setup()({ ...input, vaccineId: undefined }), /INVALID_VACCINE/)
  console.log('PASS: exact vaccine detail, trusted identity, membership, family/child ownership and deleted-record rejection')
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
