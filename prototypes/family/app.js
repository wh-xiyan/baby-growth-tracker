'use strict'
const $ = (s) => document.querySelector(s)
const names = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆', '照护者', '其他家人']
const roleLabels = { owner: '创建者', admin: '管理员', adult: '普通成员', viewer: '只读成员' }
const defaultRole = (identity) =>
  ['爸爸', '妈妈'].includes(identity) ? 'admin' : identity === '其他家人' ? 'viewer' : 'adult'
const key = 'baby-growth-family-prototype-v1'
let route = 'home',
  stack = [],
  selected = '',
  selectedMember = '',
  timer
function fresh(mode = 'guest') {
  const members = [
    { id: 'mom', identity: '妈妈', label: '豆豆妈妈', role: 'owner' },
    { id: 'dad', identity: '爸爸', label: '豆豆爸爸', role: 'admin' },
    { id: 'grandma', identity: '奶奶', label: '奶奶', role: 'adult' },
    { id: 'relative', identity: '其他家人', label: '小姨', role: 'viewer' },
  ]
  return {
    mode,
    me: { owner: 'mom', admin: 'dad', adult: 'grandma', viewer: 'relative' }[mode] || 'guest',
    members,
    family: '豆豆的小家',
    personal: null,
    children: ['豆豆'],
    request:
      mode === 'pending'
        ? { type: 'join', identity: '外婆', role: 'adult', status: 'pending' }
        : null,
    incoming: [
      { id: 'r1', identity: '外婆', role: 'adult', name: '林阿姨', status: 'pending' },
      { id: 'r2', identity: '照护者', role: 'adult', name: '陈阿姨', status: 'pending' },
    ],
    inviteActive: true,
    inviteUses: 0,
    selection: '豆豆',
    records: [
      { id: 1, title: '第一次自己扶着站起来', author: 'mom', name: '豆豆妈妈' },
      { id: 2, title: '今天量了头围 45.2 cm', author: 'grandma', name: '奶奶' },
    ],
  }
}
let state
try {
  state = JSON.parse(localStorage.getItem(key)) || fresh()
} catch {
  state = fresh()
}
const me = () => state.members.find((m) => m.id === state.me)
const role = () => me()?.role
const linked = () => Boolean(me())
const manager = () => ['owner', 'admin'].includes(role())
function persist() {
  localStorage.setItem(key, JSON.stringify(state))
}
function toast(text) {
  $('#toast').textContent = text
  $('#toast').style.display = 'block'
  clearTimeout(timer)
  timer = setTimeout(() => ($('#toast').style.display = 'none'), 3200)
}
async function confirm(title, body) {
  $('#dialog-title').textContent = title
  $('#dialog-body').textContent = body
  const dialog = $('#dialog')
  dialog.showModal()
  return new Promise((resolve) =>
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {
      once: true,
    }),
  )
}
function go(next) {
  stack.push(route)
  route = next
  selected = ''
  render()
  window.scrollTo(0, 0)
}
const escape = (s) =>
  String(s || '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
const btn = (label, action, cls = 'secondary') =>
  `<button class="${cls}" data-action="${action}">${label}</button>`
const entry = (label, detail, target) =>
  `<button class="entry" data-route="${target}"><div><b>${label}</b><span>${detail}</span></div><span>查看</span></button>`
const notice = (text) => `<div class="notice">${text}</div>`
const identityBadge = () =>
  `<span class="badge">${linked() ? escape(me().identity) + ' · ' + roleLabels[role()] : '游客 · 未关联家庭'}</span>`
function identities() {
  return `<div class="identity-grid">${names
    .map((n) => {
      const taken = state.members.some((m) => m.identity === n && m.id !== state.me)
      return `<button class="identity ${selected === n ? 'selected' : ''}" data-identity="${n}" ${taken ? 'disabled' : ''}><strong>${n}</strong><small>${taken ? '身份已占用' : roleLabels[defaultRole(n)] + ' · 默认权限'}</small></button>`
    })
    .join('')}</div>`
}
function setError(text) {
  $('#error').textContent = text
}
function render() {
  const privateRoutes = [
    'members',
    'member',
    'identity',
    'change',
    'requests',
    'invite',
    'settings',
    'transfer',
  ]
  if (!linked() && privateRoutes.includes(route) && route !== 'identity') route = 'link'
  if (['requests', 'invite', 'settings'].includes(route) && !linked()) route = 'link'
  if (['requests', 'invite'].includes(route) && !manager()) route = 'family'
  if (route === 'transfer' && role() !== 'owner') route = 'family'
  $('#scenario').value = state.mode
  const titles = {
    home: '宝宝成长录',
    mine: '我的',
    family: '我的家庭',
    link: '关联家庭',
    draft: '宝宝基础档案',
    create: '创建家庭',
    join: '加入家庭',
    progress: '申请进度',
    members: '家庭成员',
    member: '成员详情',
    identity: '我的家庭身份',
    change: '更换家庭身份',
    requests: '申请管理',
    invite: '邀请家人',
    settings: '家庭设置',
    children: '选择宝宝',
    records: '成长档案',
    transfer: '转让创建者',
  }
  $('#title').textContent = titles[route] || '我的家庭'
  $('#back').hidden = !stack.length
  document
    .querySelectorAll('[data-route]')
    .forEach((b) => b.classList.toggle('active', b.dataset.route === route))
  const badge = identityBadge()
  let html = ''
  if (route === 'home')
    html = `<section class="hero"><div class="eyebrow">一起，珍藏每个第一次</div><h1>${escape(linked() ? state.selection : state.personal?.name || '欢迎来到成长录')}</h1>${badge}<p class="muted">${linked() ? '今天也在慢慢长大' : state.personal ? '个人待关联档案 · 仅你可见' : '先建立宝宝档案，也可以接受家人的邀请'}</p></section>${!linked() ? notice('未关联家庭时，只能查看自己的宝宝基础资料与公共内容。家庭记录和媒体不会展示。') : ''}${state.request ? entry('查看申请进度', '等待确认期间，原有身份与权限保持不变', 'progress') : ''}<div class="panel">${linked() ? `<h2>今日陪伴</h2><div class="columns"><div class="count">3<small>今日照护 · 演示</small></div><div class="count">2<small>成长记录 · 演示</small></div></div>${entry('回看成长记录', '查看记录与作者权限', 'records')}` : `<h2>${state.personal ? '宝宝档案已准备好' : '开启宝宝的成长档案'}</h2>${entry(state.personal ? '更正宝宝基础资料' : '建立宝宝基础档案', '游客可建档，不开放业务记录', 'draft')}${btn('关联家庭，开启共同记录', 'link', 'primary')}`}</div><div class="panel"><h3>成长小知识</h3><p>记录宝宝每一次变化，比比较单次数字更有意义。</p><small class="muted">公共内容示例，不含任何家庭私有信息。</small></div>`
  if (route === 'mine')
    html = `<section class="hero"><h1>${escape(me()?.label || '我的成长空间')}</h1>${badge}<p class="muted">${linked() ? escape(state.family) : '还没有关联家庭'}</p></section><div class="panel">${entry(linked() ? '我的家庭' : '关联家庭', '家人一起陪伴，记录点滴成长', linked() ? 'family' : 'link')}${entry('我的家庭身份', linked() ? me().identity + ' · ' + roleLabels[role()] : '关联家庭后选择', 'identity')}${entry('宝宝资料', '个人档案与家庭宝宝', 'children')}${state.request ? entry('我的申请', '查看处理结果', 'progress') : ''}</div>`
  if (route === 'link')
    html = `<div class="step">家庭关联</div><h1>把爱，连成一个家</h1><p class="muted">一个账号仅关联一个有效家庭。加入前不会展示家庭私有数据。</p>${linked() ? notice('你已关联家庭，请先退出原家庭再关联其他家庭。') : state.request?.status === 'pending' ? `${notice('已有申请等待处理，暂不能重复关联。')}${btn('查看申请', 'progress', 'primary')}` : `<div class="panel"><h2>建立我们的小家</h2><p>创建后成为家庭创建者，选择你的身份并关联宝宝。</p>${btn('创建家庭', 'create', 'primary')}</div><div class="panel"><h2>家人已经在这里</h2><p>通过家人的邀请加入，不用重复创建宝宝。</p>${btn('邀请码加入', 'join')}</div>`}`
  if (route === 'draft')
    html = `<h1>${state.personal ? '更正宝宝资料' : '先认识一下宝宝'}</h1>${notice('个人待关联档案仅属于你；暂不能添加成长、照护、疫苗或媒体记录。')}<form id="draft-form"><label for="baby-name">宝宝昵称</label><input id="baby-name" maxlength="20" value="${escape(state.personal?.name)}" required><label for="birthday">出生日期</label><input id="birthday" type="date" max="${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)}" value="${escape(state.personal?.birthday)}" required><label for="gender">生长参考使用的性别</label><select id="gender"><option value="unknown">暂不填写</option><option value="male">男</option><option value="female">女</option></select><p class="error" id="error"></p><button class="primary">保存个人档案</button></form>`
  if (route === 'create')
    html = `<h1>建立我们的小家</h1><p class="muted">创建者权限独立于亲属身份。创建时身份名额均为空。</p><label for="family-name">家庭名称</label><input id="family-name" value="我们的小家" maxlength="30"><label for="creator-identity">我是宝宝的</label><select id="creator-identity">${names.map((n) => `<option>${n}</option>`).join('')}</select>${state.personal ? notice(`将个人档案「${escape(state.personal.name)}」归入家庭；之后由家庭共同管理。`) : notice('创建后需要补充家庭宝宝；也可以先返回建立个人档案。')}<p class="error" id="error"></p>${btn('确认创建并关联', 'submit-create', 'primary')}`
  if (route === 'join')
    html = `<h1>加入家人的成长空间</h1><label for="code">邀请码</label><input id="code" placeholder="输入 HOME26 体验" maxlength="12"><p class="muted">邀请预览仅显示家庭名称、有效状态和身份是否可选。</p>${btn('验证邀请', 'check-invite', 'primary')}<div id="invite-result"></div><p class="error" id="error"></p>`
  if (route === 'progress') {
    const r = state.request
    html = `<h1>我的申请</h1>${!r ? '<div class="empty">暂无申请</div>' : `<div class="panel"><span class="badge">${{ pending: '等待审批', approved: '已通过', rejected: '未通过', cancelled: '已取消' }[r.status]}</span><h2>${r.type === 'identity' ? '更换身份' : r.type === 'child' ? '宝宝归入家庭' : '加入家庭'}</h2><p>申请身份：${escape(r.identity || me()?.identity)}</p><p>申请权限：${roleLabels[r.role] || '保持现有权限'}</p>${r.status === 'pending' ? `<p class="muted">审批前不变更身份和权限，也不会提前开放家庭数据。</p>${btn('取消申请', 'cancel-request')}${btn('模拟审批通过', 'simulate-approve')}${btn('模拟申请被拒绝', 'simulate-reject')}` : r.status === 'approved' ? btn('进入我的家庭', 'family', 'primary') : btn('重新选择', 'link')}</div>`}`
  }
  if (route === 'family')
    html = !linked()
      ? `<h1>还没有关联家庭</h1>${badge}${btn('关联家庭', 'link', 'primary')}`
      : `<section class="hero"><div class="eyebrow">OUR LITTLE HOME</div><h1>${escape(state.family)}</h1>${badge}<p class="muted">每个人有自己的身份，一起珍藏宝宝的成长。</p></section><div class="panel"><div class="columns"><div class="count">${state.members.length}<small>位家人</small></div><div class="count">${state.children.length}<small>位宝宝</small></div></div>${entry('家庭成员', '查看家人的身份与权限', 'members')}${entry('我的身份', me().label + ' · ' + roleLabels[role()], 'identity')}${entry('宝宝档案', '当前：' + escape(state.selection || '待添加'), 'children')}</div>${manager() ? `<div class="panel">${entry('邀请家人', '分享邀请，管理员审批后加入', 'invite')}${entry('申请管理', state.incoming.filter((r) => r.status === 'pending').length + ' 条加入申请', 'requests')}${entry('家庭设置', '资料、退出与成员管理', 'settings')}</div>` : entry('家庭设置', '查看资料与退出家庭', 'settings')}`
  if (route === 'members')
    html = `<h1>一起守护的家人</h1>${notice('每种亲属身份只有一个名额；展示称谓可以修改，但不能绕过身份限制。')}<div class="panel">${state.members.map((m) => `<button class="entry" data-member="${m.id}"><div><b>${escape(m.label)}${m.id === state.me ? ' · 我' : ''}</b><span>${m.identity} · ${roleLabels[m.role]}</span></div><span>查看</span></button>`).join('')}</div>${manager() ? btn('邀请家人', 'invite', 'primary') : ''}`
  if (route === 'member') {
    const m = state.members.find((m) => m.id === selectedMember)
    html = !m
      ? '<p>成员已离开家庭</p>'
      : `<h1>${escape(m.label)}</h1><span class="badge">${m.identity} · ${roleLabels[m.role]}</span><div class="panel"><h3>当前权限</h3><p>${m.role === 'viewer' ? '仅可查看家庭记录' : m.role === 'adult' ? '可新增记录，编辑与删除本人记录' : '可管理全部家庭记录及宝宝资料'}</p></div>${m.id === state.me ? btn('修改我的称谓或身份', 'identity') : role() === 'owner' ? `<label for="member-role">调整成员权限</label><select id="member-role">${['admin', 'adult', 'viewer'].map((r) => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${roleLabels[r]}</option>`).join('')}</select>${btn('保存权限', 'save-role', 'primary')}${btn('移除成员', 'remove-member', 'secondary danger')}` : role() === 'admin' && ['adult', 'viewer'].includes(m.role) ? `<label for="member-role">调整成员权限</label><select id="member-role"><option value="adult" ${m.role === 'adult' ? 'selected' : ''}>普通成员</option><option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>只读成员</option></select>${btn('保存权限', 'save-role', 'primary')}${btn('移除成员', 'remove-member', 'secondary danger')}` : notice('仅创建者可以管理管理员或授予管理员权限。')}`
  }
  if (route === 'identity')
    html = !linked()
      ? `<h1>你是宝宝的谁？</h1>${notice('关联家庭时选择一种身份。审批通过后才生效。')}${btn('去关联家庭', 'link', 'primary')}`
      : `<h1>我的家庭身份</h1>${badge}<label for="display-name">展示称谓</label><input id="display-name" maxlength="20" value="${escape(me().label)}"><p class="muted">只修改展示称谓，不改变身份名额与权限。</p>${btn('保存称谓', 'save-label', 'primary')}<div class="panel"><h3>更换实际身份</h3><p>当前身份：${me().identity}</p><p>按新身份重新计算权限，审批后生效。创建者更换亲属身份仍保留创建者权限。</p>${btn('查看可选身份', 'change')}</div>${state.request?.status === 'pending' ? entry('身份申请处理中', '原身份及权限继续有效', 'progress') : ''}`
  if (route === 'change')
    html = `<h1>选择新的家庭身份</h1><p class="muted">原身份保留至审批成功。管理员权限变更仅由创建者批准；创建者本人可直接确认。</p><div id="identity-options">${identities()}</div><div id="impact" class="notice">选择身份后查看权限变化</div><p class="error" id="error"></p>${btn('确认权限变化并提交', 'submit-identity', 'primary')}`
  if (route === 'requests')
    html = `<h1>申请管理</h1><p class="muted">同意时再次校验身份名额。爸爸／妈妈默认管理员，仅创建者可批准。</p>${state.incoming.map((r) => `<div class="panel"><span class="badge">${r.status === 'pending' ? '待审批' : r.status === 'approved' ? '已通过' : '已拒绝'}</span><h2>${escape(r.name)}</h2><p>${r.identity} · ${roleLabels[r.role]}</p>${r.status === 'pending' ? `<label for="request-role-${r.id}">批准后权限</label><select id="request-role-${r.id}">${(role() === 'owner' ? ['admin', 'adult', 'viewer'] : ['adult', 'viewer']).map((k) => `<option value="${k}" ${r.role === k ? 'selected' : ''}>${roleLabels[k]}</option>`).join('')}</select><div class="actions"><button class="secondary" data-reject="${r.id}">拒绝</button><button class="primary" data-approve="${r.id}">同意</button></div>` : ''}</div>`).join('')}`
  if (route === 'invite')
    html = `<h1>邀请家人一起记录</h1><p class="muted">邀请不是访问凭证；选择身份并审批后，才能查看家庭数据。</p><div class="panel"><span class="badge">${state.inviteActive ? '有效邀请 · 演示' : '邀请已撤销'}</span><h2 style="font-size:32px;letter-spacing:4px">HOME26</h2><p>有效期：本次演示期间；最多 10 人次提交申请，已使用 ${state.inviteUses} 次。</p>${btn('体验收到邀请的页面', 'preview-invite')}${btn('复制邀请文案', 'copy-invite')}${btn(state.inviteActive ? '撤销邀请' : '重新生成邀请', 'toggle-invite')}</div>`
  if (route === 'settings')
    html = `<h1>家庭设置</h1><label for="family-edit">家庭名称</label><input id="family-edit" maxlength="30" value="${escape(state.family)}" ${manager() ? '' : 'disabled'}>${manager() ? btn('保存家庭名称', 'save-family', 'primary') : ''}${notice('退出或移除后立即失去家庭访问权，历史记录保留在家庭；不提供家庭解散。')}${role() === 'owner' ? `${btn('转让创建者', 'transfer')}${btn('退出家庭（须先转让）', 'leave', 'secondary danger')}` : btn('退出家庭', 'leave', 'secondary danger')}${btn('模拟权限被撤销', 'revoke')}`
  if (route === 'transfer')
    html = `<h1>转让家庭创建者</h1>${notice('接收人将成为唯一创建者，你变为管理员。转让后才可退出家庭。')}<label for="successor">选择接收人</label><select id="successor">${state.members
      .filter((m) => m.id !== state.me)
      .map((m) => `<option value="${m.id}">${escape(m.label)} · ${m.identity}</option>`)
      .join('')}</select>${btn('确认转让', 'submit-transfer', 'primary')}`
  if (route === 'children')
    html = `<h1>宝宝档案</h1>${linked() ? `<div class="panel">${state.children.length ? state.children.map((n) => btn(escape(n) + (state.selection === n ? ' · 当前' : ''), 'select-child:' + encodeURIComponent(n))).join('') : '<p>等待管理员添加宝宝。</p>'}</div>` : ''}${state.personal ? `<div class="panel"><h3>${escape(state.personal.name)}</h3><p class="muted">个人待关联档案 · 不会按名字自动合并</p>${linked() ? btn(manager() ? '将个人档案作为新宝宝加入' : '申请将个人档案加入家庭', 'attach-child', 'primary') : btn('更正基础资料', 'draft')}</div>` : !linked() ? btn('建立个人宝宝档案', 'draft', 'primary') : ''}${linked() && manager() ? `<label for="new-baby">添加家庭宝宝（演示仅填昵称）</label><input id="new-baby" maxlength="20">${btn('添加宝宝', 'add-child')}` : ''}`
  if (route === 'records')
    html = `<h1>成长档案</h1>${badge}${!linked() ? `<div class="empty">还没有家庭成长记录<br>个人基础档案不会生成演示成长记录。</div>${btn('记录成长', 'write', 'primary')}` : `${role() === 'viewer' ? notice('你拥有查看权限，不能新增、编辑或删除记录。') : btn('记录成长', 'write', 'primary')}<div class="panel">${state.records.map((r) => `<div class="entry"><div><b>${escape(r.title)}</b><span>${escape(r.name)}记录 · 演示数据</span>${manager() || (role() === 'adult' && r.author === state.me) ? `<button data-edit="${r.id}">编辑</button><button data-delete="${r.id}">删除</button>` : '<span>仅记录本人或管理员可修改</span>'}</div></div>`).join('')}</div>`}`
  $('#app').innerHTML = html
  $('#draft-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const birthday = $('#birthday').value
    if (
      !birthday ||
      birthday >
        new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    )
      return setError('出生日期不能晚于今天')
    state.personal = { name: $('#baby-name').value.trim(), birthday, gender: $('#gender').value }
    if (!state.personal.name) return setError('请填写宝宝昵称')
    persist()
    toast('个人档案已保存')
    go('home')
  })
}
async function act(action) {
  if (
    [
      'home',
      'family',
      'link',
      'join',
      'create',
      'progress',
      'identity',
      'change',
      'invite',
      'transfer',
      'draft',
    ].includes(action)
  )
    return go(action)
  if (action === 'submit-create') {
    if (linked() || state.request?.status === 'pending') return toast('已有家庭或待处理申请')
    const name = $('#family-name').value.trim()
    if (!name) return setError('请填写家庭名称')
    state.family = name
    state.members = [
      {
        id: 'self',
        identity: $('#creator-identity').value,
        label: $('#creator-identity').value,
        role: 'owner',
      },
    ]
    state.me = 'self'
    state.mode = 'owner'
    state.children = state.personal ? [state.personal.name] : []
    state.selection = state.children[0] || ''
    state.personal = null
    state.incoming = []
    persist()
    go('family')
    toast('家庭创建成功')
  }
  if (action === 'check-invite') {
    if ($('#code').value.trim().toUpperCase() !== 'HOME26')
      return setError('邀请码无效，请向家人获取新的邀请')
    if (!state.inviteActive || state.inviteUses >= 10)
      return setError('邀请已撤销或达到上限，请重新获取')
    selected = ''
    $('#error').textContent = ''
    $('#invite-result').innerHTML =
      `<div class="panel"><span class="badge">有效邀请</span><h2>${escape(state.family)}</h2><p>只展示邀请确认信息，不展示宝宝、成员姓名与家庭记录。</p><h3>选择你的身份</h3><div id="identity-options">${identities()}</div><div class="notice" id="impact">选择后查看默认权限</div>${btn('提交加入申请', 'submit-join', 'primary')}</div>`
  }
  if (action === 'submit-join') {
    if (linked()) return toast('你已关联家庭')
    if (!selected) return setError('请选择未被占用的身份')
    state.request = {
      type: 'join',
      identity: selected,
      role: defaultRole(selected),
      status: 'pending',
    }
    state.mode = 'pending'
    state.inviteUses++
    persist()
    go('progress')
  }
  if (action === 'cancel-request') {
    if (await confirm('取消申请？', '当前身份和权限不会改变。')) {
      state.request.status = 'cancelled'
      persist()
      render()
    }
  }
  if (action === 'simulate-reject') {
    state.request.status = 'rejected'
    persist()
    render()
  }
  if (action === 'simulate-approve') {
    const r = state.request
    if (r.type === 'join') {
      if (state.members.some((m) => m.identity === r.identity))
        return toast('身份已被占用，请取消后重新选择')
      state.me = 'self'
      state.members.push({ id: 'self', identity: r.identity, label: r.identity, role: r.role })
      state.mode = r.role
    } else if (r.type === 'identity') {
      if (state.members.some((m) => m.id !== state.me && m.identity === r.identity))
        return toast('新身份已被占用，原身份继续有效')
      me().identity = r.identity
      me().role = role() === 'owner' ? 'owner' : r.role
      state.mode = role()
    } else if (r.type === 'child') {
      state.children.push(state.personal.name)
      state.personal = null
    }
    r.status = 'approved'
    persist()
    render()
    toast('模拟审批通过')
  }
  if (action === 'save-label') {
    const label = $('#display-name').value.trim()
    if (!label) return toast('称谓不能为空')
    me().label = label
    persist()
    toast('称谓已更新，权限保持不变')
    render()
  }
  if (action === 'submit-identity') {
    if (!selected || selected === me().identity) return setError('请选择不同的可用身份')
    if (state.request?.status === 'pending') return setError('请先处理现有申请')
    const next = role() === 'owner' ? 'owner' : defaultRole(selected)
    if (
      !(await confirm(
        '确认身份与权限变化？',
        `${me().identity} → ${selected}；${roleLabels[role()]} → ${roleLabels[next]}。历史记录归属不变。`,
      ))
    )
      return
    if (role() === 'owner') {
      me().identity = selected
      persist()
      go('identity')
      toast('创建者已确认新身份')
    } else {
      state.request = { type: 'identity', identity: selected, role: next, status: 'pending' }
      persist()
      go('progress')
    }
  }
  if (action === 'save-role') {
    const member = state.members.find((m) => m.id === selectedMember),
      next = $('#member-role').value
    if (role() !== 'owner' && (member.role === 'admin' || next === 'admin'))
      return toast('仅创建者可以管理管理员')
    if (
      await confirm(
        '更改成员权限？',
        `${member.label}：${roleLabels[member.role]} → ${roleLabels[next]}，立即生效。`,
      )
    ) {
      member.role = next
      persist()
      render()
      toast('权限已更新')
    }
  }
  if (action === 'remove-member') {
    const member = state.members.find((m) => m.id === selectedMember)
    if (member.role === 'owner' || (role() !== 'owner' && member.role === 'admin'))
      return toast('无权移除此成员')
    if (await confirm('移除家庭成员？', '立即失去家庭访问权限，历史记录保留。身份名额将释放。')) {
      state.members = state.members.filter((m) => m.id !== member.id)
      persist()
      go('members')
    }
  }
  if (action === 'copy-invite') {
    const text = '邀请你加入 ' + state.family + '，邀请码 HOME26。选择身份后等待管理员审批。'
    try {
      await navigator.clipboard.writeText(text)
      toast('邀请文案已复制')
    } catch {
      await confirm('邀请文案', text)
    }
  }
  if (action === 'preview-invite') {
    state.mode = 'guest'
    state.me = 'guest'
    persist()
    go('join')
  }
  if (action === 'toggle-invite') {
    state.inviteActive = !state.inviteActive
    state.inviteUses = 0
    persist()
    render()
  }
  if (action === 'save-family') {
    const name = $('#family-edit').value.trim()
    if (!name) return toast('家庭名称不能为空')
    state.family = name
    persist()
    render()
    toast('家庭资料已保存')
  }
  if (action === 'leave') {
    if (role() === 'owner') return toast('创建者须先转让家庭')
    if (await confirm('退出家庭？', '退出后立即停止访问家庭数据；历史记录和家庭宝宝留在原家庭。')) {
      state.members = state.members.filter((m) => m.id !== state.me)
      state.me = 'guest'
      state.mode = 'guest'
      state.request = null
      persist()
      go('home')
    }
  }
  if (action === 'submit-transfer') {
    const successor = state.members.find((m) => m.id === $('#successor').value)
    if (!successor) return toast('请先邀请一位家庭成员')
    if (await confirm('确认转让？', `将创建者转让给${successor.label}，你变为管理员。`)) {
      me().role = 'admin'
      successor.role = 'owner'
      state.mode = 'admin'
      persist()
      go('settings')
    }
  }
  if (action === 'revoke') {
    state.members = state.members.filter((m) => m.id !== state.me)
    state.me = 'guest'
    state.mode = 'guest'
    state.request = null
    persist()
    go('home')
    toast('权限已失效，家庭数据访问已关闭')
  }
  if (action.startsWith('select-child:')) {
    state.selection = decodeURIComponent(action.slice(13))
    persist()
    render()
    toast('已切换宝宝')
  }
  if (action === 'add-child') {
    const name = $('#new-baby').value.trim()
    if (!name) return toast('请填写昵称')
    state.children.push(name)
    state.selection = name
    persist()
    render()
  }
  if (action === 'attach-child') {
    if (manager()) {
      if (await confirm('作为新宝宝归入家庭？', '不会与同名宝宝合并。归入后由家庭共同管理。')) {
        state.children.push(state.personal.name)
        state.personal = null
        persist()
        render()
      }
    } else {
      if (state.request?.status === 'pending') return toast('请先处理已有申请')
      state.request = { type: 'child', status: 'pending' }
      persist()
      go('progress')
    }
  }
  if (action === 'write') {
    if (!linked()) return go('link')
    if (role() === 'viewer') return toast('当前只有查看权限')
    const title = prompt('输入一条成长记录标题（演示）')
    if (title?.trim()) {
      state.records.unshift({
        id: Date.now(),
        title: title.trim(),
        author: state.me,
        name: me().label,
      })
      persist()
      render()
    }
  }
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button')
  if (!b || b.disabled) return
  if (b.dataset.route) return go(b.dataset.route)
  if (b.dataset.action) return act(b.dataset.action)
  if (b.dataset.identity) {
    selected = b.dataset.identity
    $('#identity-options').innerHTML = identities()
    $('#impact').textContent =
      `${linked() ? '当前：' + roleLabels[role()] + '；变更后：' : '默认权限：'}${roleLabels[role() === 'owner' ? 'owner' : defaultRole(selected)]}。${defaultRole(selected) === 'viewer' ? '仅查看，不可新增编辑删除。' : '普通成员仅能管理本人记录，管理员可管理全部。'} 审批后生效。`
  }
  if (b.dataset.member) {
    selectedMember = b.dataset.member
    go('member')
  }
  if (b.dataset.approve || b.dataset.reject) {
    if (!manager()) return toast('没有审批权限')
    const r = state.incoming.find((x) => x.id === (b.dataset.approve || b.dataset.reject))
    if (r.status !== 'pending') return
    if (b.dataset.reject) r.status = 'rejected'
    else {
      const next = $('#request-role-' + r.id).value
      if (next === 'admin' && role() !== 'owner') return toast('仅创建者可以授予管理员')
      if (state.members.some((m) => m.identity === r.identity))
        return toast('该身份已占用，请申请人重新选择')
      r.status = 'approved'
      state.members.push({ id: r.id, identity: r.identity, label: r.name, role: next })
    }
    persist()
    render()
  }
  if (b.dataset.delete || b.dataset.edit) {
    const id = Number(b.dataset.delete || b.dataset.edit),
      r = state.records.find((x) => x.id === id)
    if (!linked() || !(manager() || (role() === 'adult' && r.author === state.me)))
      return toast('当前没有操作权限')
    if (b.dataset.delete) {
      if (await confirm('删除成长记录？', '记录与独占附件将被删除，其他记录引用的媒体保留。'))
        state.records = state.records.filter((x) => x.id !== id)
    } else {
      const title = prompt('修改记录标题', r.title)
      if (title?.trim()) r.title = title.trim()
    }
    persist()
    render()
  }
})
$('#back').onclick = () => {
  route = stack.pop() || 'home'
  selected = ''
  render()
}
$('#home').onclick = () => go('home')
$('#scenario').onchange = (e) => {
  state = fresh(e.target.value)
  persist()
  stack = []
  route = 'home'
  render()
}
$('#reset').onclick = () => {
  state = fresh(state.mode)
  persist()
  stack = []
  route = 'home'
  render()
}
render()
