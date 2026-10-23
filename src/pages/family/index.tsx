import { Button, Input, Picker, Text, View } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { relationships, defaultRole, isManager, roleLabels } from '../../domain/family'
import { useSessionStore } from '../../stores/session'
import {
  familyAction,
  familyError,
  getFamilyOverview,
  refreshFamilySession,
} from '../../services/family'
import { usePageDidShow } from '../../services/media-preview'
import type { FamilyMember, FamilyOverview, FamilyRequest, FamilyRole } from '../../types/family'
import { isCloudConfigured } from '../../services/cloud'
import { localDate } from '../../utils/home'
import './index.scss'

type Screen =
  | 'overview'
  | 'link'
  | 'create'
  | 'join'
  | 'progress'
  | 'members'
  | 'identity'
  | 'change'
  | 'requests'
  | 'invite'
  | 'settings'
  | 'children'
  | 'addChild'
  | 'member'
  | 'transfer'
const blank: FamilyOverview = {
  members: [],
  requests: [],
  familyRequests: [],
  invitations: [],
  personalChildren: [],
}
export default function Family() {
  const { params } = useRouter(),
    {
      family,
      currentRole,
      membership,
      children,
      childId,
      setCurrentChild,
      initialized,
      membershipIssue,
    } = useSessionStore()
  const [reviewRoles, setReviewRoles] = useState<Record<string, FamilyRole>>({})
  const [screen, setScreen] = useState<Screen>(params.code ? 'join' : 'overview'),
    [data, setData] = useState<FamilyOverview>(blank),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [name, setName] = useState(''),
    [identity, setIdentity] = useState(''),
    [code, setCode] = useState(params.code || ''),
    [invite, setInvite] = useState<{ name: string; occupied: string[] }>(),
    [shareCode, setShareCode] = useState(''),
    [label, setLabel] = useState(''),
    [selected, setSelected] = useState<FamilyMember>(),
    [memberRole, setMemberRole] = useState<FamilyRole>('adult'),
    [successor, setSuccessor] = useState(''),
    [draftId, setDraftId] = useState(''),
    [birthday, setBirthday] = useState(''),
    [gender, setGender] = useState('unknown')
  const pending = useRef(false),
    sequence = useRef(0)
  const manager = isManager(currentRole),
    owner = currentRole === 'owner',
    linked = Boolean(family),
    mine = data.members.find((m) => m.id === membership?.id) || membership
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setError('')
    try {
      await refreshFamilySession()
      const result = await getFamilyOverview()
      if (request === sequence.current) {
        setData(result)
        setSelected((previous) =>
          previous ? result.members.find((m) => m.id === previous.id) : undefined,
        )
      }
    } catch (cause) {
      if (request === sequence.current) setError(familyError(cause))
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (initialized) void load()
  }, [initialized, load])
  usePageDidShow(() => {
    if (initialized) void load()
  })
  useShareAppMessage(() => ({
    title: `邀请你加入${family?.name || '宝宝的小家'}`,
    path: `/pages/family/index?code=${encodeURIComponent(shareCode)}`,
  }))
  const go = (next: Screen) => {
    setScreen(next)
    setError('')
    setName(next === 'settings' ? family?.name || '' : '')
    setIdentity('')
    setLabel(mine?.displayName || '')
    setInvite(undefined)
    setSelected(undefined)
    if (next !== 'invite') setShareCode('')
  }
  const run = async (
    action: string,
    input: Record<string, unknown> = {},
    confirmation?: string,
  ) => {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    try {
      if (confirmation) {
        const answer = await Taro.showModal({ title: '确认操作', content: confirmation })
        if (!answer.confirm) return false
      }
      const result = await familyAction(action, input)
      if (action === 'createInvite' && result.code) setShareCode(String(result.code))
      if (action === 'revokeInvite') setShareCode('')
      await load()
      Taro.showToast({ title: '操作成功', icon: 'success' })
      return true
    } catch (cause) {
      setError(familyError(cause))
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const enterMember = (m: FamilyMember) => {
    go('member')
    setSelected(m)
    setMemberRole(m.role)
  }
  const chooseIdentity = (available: string[]) => (
    <View className='family-identities'>
      {relationships.map((value) => (
        <Button
          key={value}
          disabled={busy || !available.includes(value)}
          className={identity === value ? 'selected' : ''}
          onClick={() => setIdentity(value)}
        >
          <Text>{value}</Text>
          <Text className='family-muted'>
            {available.includes(value) ? roleLabels[defaultRole(value)] : '身份已占用'}
          </Text>
        </Button>
      ))}
    </View>
  )
  const available = relationships.filter((r) => !data.members.some((m) => m.relationshipCode === r))
  const button = (text: string, onClick: () => void, primary = false, disabled = false) => (
    <Button
      className={primary ? 'family-primary' : 'family-secondary'}
      disabled={busy || disabled}
      loading={busy}
      onClick={onClick}
    >
      {text}
    </Button>
  )
  const row = (title: string, detail: string, next: Screen) => (
    <Button className='family-row' onClick={() => go(next)}>
      <View>
        <Text>{title}</Text>
        <Text className='family-muted'>{detail}</Text>
      </View>
      <Text>›</Text>
    </Button>
  )
  const badge = (
    <View className='family-badge'>
      {linked
        ? `${mine?.relationshipCode || '身份待完善'} · ${currentRole ? roleLabels[currentRole] : '权限同步中'}`
        : '游客 · 未关联家庭'}
    </View>
  )
  const requestName = (r: FamilyRequest) =>
    r.type === 'join'
      ? '加入家庭'
      : r.type === 'identity_change'
        ? '更换家庭身份'
        : '个人宝宝归入家庭'
  const canReview = (r: FamilyRequest) =>
    manager &&
    r.userId !== useSessionStore.getState().userId &&
    (owner ||
      (r.payload.role !== 'admin' &&
        data.members.find((m) => m.userId === r.userId)?.role !== 'admin'))
  const submitReview = async (r: FamilyRequest, approve: boolean) => {
    await run(
      'review',
      { requestId: r.id, version: r.version, approve, role: reviewRoles[r.id] || r.payload.role },
      approve
        ? `批准${requestName(r)}，${r.payload.identity || ''}。权限：${r.payload.role ? roleLabels[reviewRoles[r.id] || r.payload.role] : '保持原权限'}，审批后立即生效。`
        : '拒绝此申请？申请人当前身份和权限不变。',
    )
  }
  const denied =
    linked &&
    ((['requests', 'invite', 'addChild'].includes(screen) && !manager) ||
      (screen === 'transfer' && !owner))
  const privateScreen = !['overview', 'link', 'create', 'join', 'progress', 'children'].includes(
    screen,
  )
  return (
    <View className='family-page'>
      <View className='family-heading'>
        <Text className='family-heading-title'>我的家庭</Text>
        {screen !== 'overview' && <Button onClick={() => go('overview')}>返回概览</Button>}
      </View>
      {badge}
      {membershipIssue &&
        data.legacyFamilies?.map((f) => (
          <View key={f.id} className='family-notice'>
            <Text>
              {f.name} · {roleLabels[f.role]}
            </Text>
            {button(
              '整理此旧家庭',
              () =>
                void run('setLegacyContext', { targetId: f.id }).then((ok) => {
                  if (ok) go('settings')
                }),
            )}
            <Text className='family-muted'>
              选择后在设置中退出；如果是创建者，请先转让，再退出。保留一个有效家庭后恢复正常使用。
            </Text>
          </View>
        ))}
      {!loading && membershipIssue && (
        <View className='family-notice'>
          旧账号存在多个有效家庭关联，已停止写入。请选择上方旧家庭逐一整理，退出不保留的家庭。
        </View>
      )}
      {loading ? (
        <View className='family-notice'>正在同步家庭身份与权限…</View>
      ) : (
        <>
          {privateScreen && !linked ? (
            <View className='family-card'>
              <Text>请先关联家庭</Text>
              {button('关联家庭', () => go('link'), true)}
            </View>
          ) : denied ? (
            <View className='family-notice'>
              <Text>家庭权限已变化，当前无法继续操作。</Text>
              {button('返回家庭概览', () => go('overview'))}
            </View>
          ) : (
            <>
              {screen === 'overview' && (
                <>
                  <Text className='family-title'>{family?.name || '把爱，连成一个家'}</Text>
                  <Text className='family-muted'>每个人有自己的身份，一起守护宝宝的成长。</Text>
                  {!linked ? (
                    <>
                      <View className='family-notice'>
                        未关联家庭时，仅能查看和更正本人宝宝基础档案。关联并审批通过后，才能查看家庭记录。
                      </View>
                      {button('创建家庭 / 加入家庭', () => go('link'), true)}
                      {row(
                        '个人宝宝档案',
                        `${data.personalChildren.length} 位宝宝 · 仅本人可见`,
                        'children',
                      )}
                    </>
                  ) : (
                    <>
                      <View className='family-card'>
                        <Text className='family-count'>
                          {data.members.length} 位家人 · {children.length} 位宝宝
                        </Text>
                        {row('家庭成员', '查看称谓、身份与权限', 'members')}
                        {row(
                          '我的家庭身份',
                          `${mine?.displayName || '未填写'} · ${mine?.relationshipCode || '请完善身份'}`,
                          'identity',
                        )}
                        {row(
                          '宝宝档案',
                          children.find((c) => c.id === childId)?.name || '等待添加宝宝',
                          'children',
                        )}
                      </View>
                      {manager && (
                        <View className='family-card'>
                          {row('邀请家人', '邀请后需审批才能加入', 'invite')}
                          {row(
                            '申请管理',
                            `${data.familyRequests.length} 条待处理申请`,
                            'requests',
                          )}
                        </View>
                      )}
                      {row('家庭设置', '家庭资料、退出与创建者转让', 'settings')}
                    </>
                  )}
                  {row(
                    '我的申请',
                    `${data.requests.filter((r) => r.status === 'pending').length} 条待处理`,
                    'progress',
                  )}
                </>
              )}
              {screen === 'link' && (
                <>
                  <Text className='family-title'>一起开启成长记录</Text>
                  {linked ? (
                    <View className='family-notice'>
                      你已关联家庭，不能同时创建或加入第二个家庭。
                    </View>
                  ) : data.requests.some((r) => r.status === 'pending') ? (
                    <>{button('已有待处理申请，查看进度', () => go('progress'), true)}</>
                  ) : (
                    <>
                      <View className='family-card'>
                        <Text className='family-subtitle'>建立我们的小家</Text>
                        <Text className='family-muted'>创建者权限独立于亲属身份。</Text>
                        {button('创建家庭', () => go('create'), true)}
                      </View>
                      <View className='family-card'>
                        <Text className='family-subtitle'>家人已经在这里</Text>
                        <Text className='family-muted'>使用邀请加入，无需重复建立宝宝档案。</Text>
                        {button('输入邀请码', () => go('join'))}
                      </View>
                    </>
                  )}
                </>
              )}
              {screen === 'create' && !linked && (
                <>
                  <Text className='family-title'>创建家庭</Text>
                  <Text className='family-label'>家庭名称</Text>
                  <Input
                    maxlength={30}
                    value={name}
                    onInput={(e) => setName(e.detail.value)}
                    placeholder='例如：我们的小家'
                  />
                  <Text className='family-label'>我是宝宝的</Text>
                  <Picker
                    range={[...relationships]}
                    onChange={(e) => setIdentity(relationships[Number(e.detail.value)])}
                  >
                    <View className='family-picker'>{identity || '请选择家庭身份'}</View>
                  </Picker>
                  <Text className='family-label'>将个人宝宝档案归入家庭（可选）</Text>
                  <Picker
                    range={['稍后添加', ...data.personalChildren.map((c) => c.name)]}
                    onChange={(e) =>
                      setDraftId(data.personalChildren[Number(e.detail.value) - 1]?.id || '')
                    }
                  >
                    <View className='family-picker'>
                      {data.personalChildren.find((c) => c.id === draftId)?.name || '稍后添加'}
                    </View>
                  </Picker>
                  <View className='family-notice'>
                    创建后成为唯一创建者；选中的个人档案由家庭共同管理，不会按姓名合并。
                  </View>
                  {button(
                    '确认创建',
                    () =>
                      void run('create', { name, identity, childId: draftId }).then((ok) => {
                        if (ok) go('overview')
                      }),
                    true,
                    !name.trim() || !identity,
                  )}
                </>
              )}
              {screen === 'join' && !linked && (
                <>
                  <Text className='family-title'>加入家人的成长空间</Text>
                  <Text className='family-label'>邀请码</Text>
                  <Input
                    value={code}
                    maxlength={64}
                    onInput={(e) => {
                      setCode(e.detail.value)
                      setInvite(undefined)
                      setIdentity('')
                    }}
                    placeholder='请输入家人分享的邀请码'
                  />
                  {button(
                    '验证邀请',
                    () => {
                      if (pending.current) return
                      pending.current = true
                      setBusy(true)
                      setError('')
                      void familyAction<{ name: string; occupied: string[] }>('previewInvite', {
                        code,
                      })
                        .then(setInvite)
                        .catch((cause) => setError(familyError(cause)))
                        .finally(() => {
                          pending.current = false
                          setBusy(false)
                        })
                    },
                    true,
                    !code.trim(),
                  )}
                  {invite && (
                    <View className='family-card'>
                      <Text className='family-subtitle'>{invite.name}</Text>
                      <Text className='family-muted'>
                        只展示家庭名称及身份可用性，不开放家庭私有数据。
                      </Text>
                      {chooseIdentity(relationships.filter((r) => !invite.occupied.includes(r)))}
                      <Text className='family-label'>展示称谓（方便家人确认申请人）</Text>
                      <Input
                        maxlength={20}
                        value={label}
                        onInput={(e) => setLabel(e.detail.value)}
                        placeholder={identity || '例如：豆豆外婆'}
                      />
                      {identity && (
                        <View className='family-notice'>
                          申请身份：{identity}；默认{roleLabels[defaultRole(identity)]}
                          。管理员权限仅创建者可批准。
                        </View>
                      )}
                      {button(
                        '提交加入申请',
                        () =>
                          void run('join', { code, identity, label }).then((ok) => {
                            if (ok) go('progress')
                          }),
                        true,
                        !identity,
                      )}
                    </View>
                  )}
                </>
              )}
              {screen === 'progress' && (
                <>
                  <Text className='family-title'>我的申请</Text>
                  {!data.requests.length && <View className='family-notice'>暂无申请</View>}
                  {data.requests
                    .slice()
                    .reverse()
                    .map((r) => (
                      <View className='family-card' key={r.id}>
                        <Text className='family-subtitle'>{requestName(r)}</Text>
                        <Text>{r.payload.identity || '宝宝档案关联'}</Text>
                        <Text className='family-muted'>
                          {
                            {
                              pending: '等待审批',
                              approved: '已通过',
                              rejected: '未通过',
                              cancelled: '已取消',
                            }[r.status]
                          }
                        </Text>
                        {r.payload.role && (
                          <Text className='family-muted'>
                            申请权限：{roleLabels[r.payload.role]}
                          </Text>
                        )}
                        {r.status === 'pending' ? (
                          <>
                            {button(
                              '取消申请',
                              () =>
                                void run(
                                  'cancelRequest',
                                  { requestId: r.id },
                                  '取消后当前身份与权限不变。',
                                ),
                            )}
                          </>
                        ) : r.status === 'approved' ? (
                          button('选择宝宝', () => go('children'))
                        ) : (
                          button('返回关联入口', () => go('link'))
                        )}
                      </View>
                    ))}
                </>
              )}
              {screen === 'members' && (
                <>
                  <Text className='family-title'>一起守护的家人</Text>
                  <View className='family-notice'>
                    每种身份只有一个名额；修改称谓不会改变身份或权限。
                  </View>
                  {data.members.map((m) => (
                    <Button key={m.id} className='family-row' onClick={() => enterMember(m)}>
                      <View>
                        <Text>
                          {m.displayName}
                          {m.id === mine?.id ? ' · 我' : ''}
                        </Text>
                        <Text className='family-muted'>
                          {m.relationshipCode || '身份待完善'} · {roleLabels[m.role]}
                        </Text>
                      </View>
                      <Text>›</Text>
                    </Button>
                  ))}
                </>
              )}
              {screen === 'member' && selected && (
                <>
                  <Text className='family-title'>{selected.displayName}</Text>
                  <Text>
                    {selected.relationshipCode || '身份待完善'} · {roleLabels[selected.role]}
                  </Text>
                  <View className='family-notice'>
                    {selected.role === 'viewer'
                      ? '仅查看家庭数据'
                      : selected.role === 'adult'
                        ? '可新增记录，并编辑、删除本人记录'
                        : '可管理全部家庭记录与宝宝资料'}
                  </View>
                  {selected.id === mine?.id ? (
                    button('修改我的称谓与身份', () => go('identity'))
                  ) : manager &&
                    selected.role !== 'owner' &&
                    (owner || selected.role !== 'admin') ? (
                    <>
                      <Text className='family-label'>调整权限</Text>
                      <Picker
                        range={(owner ? ['admin', 'adult', 'viewer'] : ['adult', 'viewer']).map(
                          (r) => roleLabels[r as FamilyRole],
                        )}
                        onChange={(e) =>
                          setMemberRole(
                            (owner ? ['admin', 'adult', 'viewer'] : ['adult', 'viewer'])[
                              Number(e.detail.value)
                            ] as FamilyRole,
                          )
                        }
                      >
                        <View className='family-picker'>{roleLabels[memberRole]}</View>
                      </Picker>
                      {button(
                        '保存权限',
                        () =>
                          void run(
                            'role',
                            { targetId: selected.id, role: memberRole, version: selected.version },
                            `将${selected.displayName}调整为${roleLabels[memberRole]}，立即生效。`,
                          ).then((ok) => {
                            if (ok) go('members')
                          }),
                        true,
                      )}
                      {button(
                        '移除成员',
                        () =>
                          void run(
                            'remove',
                            { targetId: selected.id, version: selected.version },
                            '移除后立即失去家庭访问权，历史记录留在家庭。',
                          ).then((ok) => {
                            if (ok) go('members')
                          }),
                      )}
                    </>
                  ) : (
                    <Text className='family-muted'>仅创建者可以管理管理员；不能移除创建者。</Text>
                  )}
                </>
              )}
              {screen === 'identity' && (
                <>
                  <Text className='family-title'>我的家庭身份</Text>
                  <Text className='family-label'>展示称谓</Text>
                  <Input value={label} maxlength={20} onInput={(e) => setLabel(e.detail.value)} />
                  <Text className='family-muted'>仅更改展示称谓，不改变身份名额或权限。</Text>
                  {button(
                    '保存称谓',
                    () => void run('updateLabel', { label }),
                    true,
                    !label.trim(),
                  )}
                  <View className='family-card'>
                    <Text>实际身份：{mine?.relationshipCode || '尚未设置'}</Text>
                    <Text className='family-muted'>
                      更换身份会重新计算权限，审批后生效。创建者保留创建者权限。
                    </Text>
                    {button(mine?.relationshipCode ? '更换实际身份' : '补充家庭身份', () =>
                      go('change'),
                    )}
                  </View>
                </>
              )}
              {screen === 'change' && (
                <>
                  <Text className='family-title'>选择家庭身份</Text>
                  {chooseIdentity(available)}
                  {identity && (
                    <View className='family-notice'>
                      当前：{currentRole ? roleLabels[currentRole] : '未获取'} →{' '}
                      {owner
                        ? roleLabels.owner
                        : !mine?.relationshipCode
                          ? '保留原有权限'
                          : roleLabels[defaultRole(identity)]}
                      。
                      {!mine?.relationshipCode
                        ? '旧账号首次补选身份保留原权限。'
                        : '审批通过前原身份和权限继续有效。'}
                    </View>
                  )}
                  {button(
                    '确认身份与权限变化',
                    () =>
                      void run(
                        mine?.relationshipCode ? 'requestIdentity' : 'claimIdentity',
                        { identity },
                        `确认选择${identity}？${owner ? '创建者权限保持不变。' : mine?.relationshipCode ? '审批后按新身份默认权限生效。' : '首次补选保留原权限。'}`,
                      ).then((ok) => {
                        if (ok) go(owner || !mine?.relationshipCode ? 'identity' : 'progress')
                      }),
                    true,
                    !identity,
                  )}
                </>
              )}
              {screen === 'requests' && manager && (
                <>
                  <Text className='family-title'>申请管理</Text>
                  <Text className='family-muted'>
                    管理员申请和管理员的身份变更仅创建者可审批；本人不能审批本人申请。
                  </Text>
                  {!data.familyRequests.length && (
                    <View className='family-notice'>暂无待处理申请</View>
                  )}
                  {data.familyRequests.map((r) => (
                    <View className='family-card' key={r.id}>
                      <Text className='family-subtitle'>{requestName(r)}</Text>
                      <Text>{r.payload.identity || '个人宝宝归入家庭'}</Text>
                      <Text className='family-muted'>
                        申请人：
                        {data.members.find((m) => m.userId === r.userId)?.displayName ||
                          r.payload.displayName ||
                          '新成员'}{' '}
                        · {r.payload.role ? roleLabels[r.payload.role] : '保持现有权限'}
                      </Text>
                      {canReview(r) ? (
                        <View>
                          {r.type !== 'child_attach' && (
                            <Picker
                              range={(owner
                                ? ['admin', 'adult', 'viewer']
                                : ['adult', 'viewer']
                              ).map((role) => roleLabels[role as FamilyRole])}
                              onChange={(e) =>
                                setReviewRoles((current) => ({
                                  ...current,
                                  [r.id]: (owner
                                    ? ['admin', 'adult', 'viewer']
                                    : ['adult', 'viewer'])[Number(e.detail.value)] as FamilyRole,
                                }))
                              }
                            >
                              <View className='family-picker'>
                                批准权限：
                                {roleLabels[reviewRoles[r.id] || r.payload.role || 'viewer']}
                              </View>
                            </Picker>
                          )}
                          <View className='family-actions'>
                            {button('拒绝', () => void submitReview(r, false))}
                            {button('同意', () => void submitReview(r, true), true)}
                          </View>
                        </View>
                      ) : (
                        <View className='family-notice'>
                          等待其他有权成员处理；管理员相关申请仅创建者可处理。
                        </View>
                      )}
                    </View>
                  ))}
                </>
              )}
              {screen === 'invite' && manager && (
                <>
                  <Text className='family-title'>邀请家人一起记录</Text>
                  <View className='family-notice'>
                    邀请7天有效，最多10次申请。通过审批后才开放家庭数据。
                  </View>
                  {button('生成新邀请', () => void run('createInvite'), true)}
                  {shareCode && (
                    <View className='family-card'>
                      <Text selectable>{shareCode}</Text>
                      {button('复制邀请码', () => void Taro.setClipboardData({ data: shareCode }))}
                      <Button className='family-primary' openType='share'>
                        分享给家人
                      </Button>
                      <Text className='family-muted'>
                        邀请原文只在生成后展示；请及时保存，离开后可重新生成。
                      </Text>
                    </View>
                  )}
                  {data.invitations.map((i) => (
                    <View className='family-card' key={i.id}>
                      <Text>
                        使用 {i.usedCount}/{i.maxUses} 次 · 到期 {String(i.expiresAt).slice(0, 10)}
                      </Text>
                      {button(
                        '撤销此邀请',
                        () =>
                          void run(
                            'revokeInvite',
                            { inviteId: i.id },
                            '撤销后无法提交或批准使用此邀请的加入申请。',
                          ),
                      )}
                    </View>
                  ))}
                </>
              )}
              {screen === 'settings' && (
                <>
                  <Text className='family-title'>家庭设置</Text>
                  <Input
                    value={name}
                    maxlength={30}
                    disabled={!manager}
                    onInput={(e) => setName(e.detail.value)}
                  />
                  {manager &&
                    button(
                      '保存家庭名称',
                      () => void run('updateFamily', { name }),
                      true,
                      !name.trim(),
                    )}
                  <View className='family-notice'>
                    退出后家庭宝宝、历史记录及媒体保留在原家庭，不会复制到个人档案。暂不提供家庭解散。
                  </View>
                  {owner && button('转让创建者', () => go('transfer'))}
                  {button(
                    owner ? '退出家庭（须先转让）' : '退出家庭',
                    () =>
                      void run('leave', {}, '退出后立即失去家庭访问权，历史记录保留。').then(
                        (ok) => {
                          if (ok) go('overview')
                        },
                      ),
                  )}
                </>
              )}
              {screen === 'transfer' && owner && (
                <>
                  <Text className='family-title'>转让创建者</Text>
                  <View className='family-notice'>
                    接收人成为唯一创建者，你将变为管理员。转让不交换亲属身份。
                  </View>
                  <Picker
                    range={data.members.filter((m) => m.id !== mine?.id).map((m) => m.displayName)}
                    onChange={(e) =>
                      setSuccessor(
                        data.members.filter((m) => m.id !== mine?.id)[Number(e.detail.value)].id,
                      )
                    }
                  >
                    <View className='family-picker'>
                      {data.members.find((m) => m.id === successor)?.displayName || '选择接收人'}
                    </View>
                  </Picker>
                  {button(
                    '确认转让',
                    () =>
                      void run(
                        'transfer',
                        { targetId: successor },
                        '确认转让？接收人将成为唯一创建者，你变为管理员。',
                      ).then((ok) => {
                        if (ok) go('settings')
                      }),
                    true,
                    !successor,
                  )}
                </>
              )}
              {screen === 'children' && (
                <>
                  <Text className='family-title'>宝宝档案</Text>
                  {linked &&
                    children.map((c) => (
                      <View className='family-card' key={c.id}>
                        <Text>
                          {c.name}
                          {c.id === childId ? ' · 当前宝宝' : ''}
                        </Text>
                        {button('选择并查看', () => {
                          setCurrentChild(c.id)
                          void Taro.navigateTo({ url: '/pages/child-profile/index' })
                        })}
                      </View>
                    ))}
                  {data.personalChildren.map((c) => (
                    <View className='family-card' key={c.id}>
                      <Text>{c.name} · 个人待关联</Text>
                      <Text className='family-muted'>不自动与同名宝宝合并</Text>
                      {linked &&
                        button(
                          '更正个人基础资料',
                          () =>
                            void Taro.navigateTo({
                              url: `/pages/child-profile/index?id=${encodeURIComponent(c.id)}`,
                            }),
                        )}
                      {linked
                        ? button(
                            manager ? '作为新宝宝归入家庭' : '申请将宝宝归入家庭',
                            () =>
                              void run(
                                'requestChild',
                                { childId: c.id },
                                '归入后由家庭共同管理，不会合并同名宝宝。',
                              ),
                          )
                        : button('查看与更正基础资料', () => {
                            setCurrentChild(c.id)
                            void Taro.navigateTo({ url: '/pages/child-profile/index' })
                          })}
                    </View>
                  ))}
                  {!linked
                    ? button(
                        '建立个人宝宝档案',
                        () => void Taro.navigateTo({ url: '/pages/onboarding/index' }),
                        true,
                      )
                    : manager
                      ? button(
                          '添加家庭宝宝',
                          () => {
                            go('addChild')
                            setBirthday('')
                            setGender('unknown')
                          },
                          true,
                        )
                      : !children.length && (
                          <View className='family-notice'>等待管理员添加宝宝</View>
                        )}
                </>
              )}
              {screen === 'addChild' && manager && (
                <>
                  <Text className='family-title'>添加宝宝</Text>
                  <Text className='family-label'>昵称</Text>
                  <Input value={name} maxlength={50} onInput={(e) => setName(e.detail.value)} />
                  <Text className='family-label'>出生日期</Text>
                  <Picker
                    mode='date'
                    value={birthday || localDate()}
                    end={localDate()}
                    onChange={(e) => setBirthday(e.detail.value)}
                  >
                    <View className='family-picker'>{birthday || '请选择日期'}</View>
                  </Picker>
                  <Picker
                    range={['未填写', '男童', '女童']}
                    onChange={(e) =>
                      setGender(['unknown', 'male', 'female'][Number(e.detail.value)])
                    }
                  >
                    <View className='family-picker'>
                      {gender === 'male' ? '男童' : gender === 'female' ? '女童' : '性别未填写'}
                    </View>
                  </Picker>
                  {button(
                    '保存宝宝档案',
                    () =>
                      void run('addChild', { data: { name, birthday, gender } }).then((ok) => {
                        if (ok) go('children')
                      }),
                    true,
                    !name.trim() || !birthday,
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <View className='family-error'>
          <Text>{error}</Text>
          <Button onClick={() => void load()}>重新同步</Button>
        </View>
      )}
      <Text className='family-footnote'>
        {isCloudDemo()
          ? '本地演示模式：数据保存在本机，邀请无法跨设备使用。'
          : '数据仅向有效家庭成员开放。'}
      </Text>
    </View>
  )
}
function isCloudDemo() {
  return !isCloudConfigured()
}
