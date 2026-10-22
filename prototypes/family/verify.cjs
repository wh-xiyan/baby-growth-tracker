const vm = require('node:vm'),
  fs = require('node:fs'),
  assert = require('node:assert/strict')
const nodes = new Map(),
  storage = new Map()
function node(id) {
  if (!nodes.has(id))
    nodes.set(id, {
      value: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      style: {},
      dataset: {},
      classList: { toggle() {} },
      addEventListener() {},
    })
  return nodes.get(id)
}
const sandbox = {
  document: { querySelector: node, querySelectorAll: () => [], addEventListener() {} },
  localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
  window: { scrollTo() {} },
  navigator: {},
  console,
  setTimeout: () => 1,
  clearTimeout() {},
  prompt: () => null,
}
vm.createContext(sandbox)
vm.runInContext(fs.readFileSync(__dirname + '/app.js', 'utf8'), sandbox)
const run = (s) => vm.runInContext(s, sandbox)
async function main() {
  assert.match(run("$('#app').innerHTML"), /宝宝基础资料/)
  run("route='records';render()")
  assert.doesNotMatch(run("$('#app').innerHTML"), /第一次自己扶着/)
  run("route='members';render()")
  assert.equal(run('route'), 'link')
  run("state=fresh('viewer');route='records';render()")
  assert.doesNotMatch(run("$('#app').innerHTML"), /data-delete/)
  run("state=fresh('adult');route='records';render()")
  assert.match(run("$('#app').innerHTML"), /data-edit="2"/)
  assert.doesNotMatch(run("$('#app').innerHTML"), /data-edit="1"/)
  run("state=fresh('admin');selectedMember='mom';route='member';render()")
  assert.doesNotMatch(run("$('#app').innerHTML"), /id="member-role"/)
  run("state=fresh('owner');selectedMember='dad';route='member';render()")
  assert.match(run("$('#app').innerHTML"), /value="admin"/)
  run("state=fresh('guest');route='join';render();$('#code').value='BAD'")
  await run("act('check-invite')")
  assert.match(run("$('#error').textContent"), /无效/)
  run("$('#code').value='HOME26'")
  await run("act('check-invite')")
  assert.match(run("$('#invite-result').innerHTML"), /身份已占用/)
  run("selected='外婆'")
  await run("act('submit-join')")
  assert.equal(run('state.request.status'), 'pending')
  assert.equal(run('linked()'), false)
  await run("act('simulate-approve')")
  assert.equal(run('linked()'), true)
  assert.equal(run('role()'), 'adult')
  run("state=fresh('adult');$('#display-name').value='豆豆奶奶'")
  await run("act('save-label')")
  assert.equal(run('role()'), 'adult')
  assert.equal(run('me().identity'), '奶奶')
  run("state=fresh('owner');route='change';render()")
  assert.match(run('identities()'), /身份已占用/)
  console.log(
    'PASS 12 prototype checks: guest isolation, page guards, roles, invitations, approval, identity labels',
  )
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
