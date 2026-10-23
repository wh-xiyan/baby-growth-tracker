import Taro from '@tarojs/taro'
import { mutateFamily, isManager, type FamilyPort } from '../domain/family'
import { callCloudFunction, isCloudConfigured } from './cloud'
import { useSessionStore } from '../stores/session'
import type { BootstrapResult } from './auth'
import type { FamilyOverview, FamilyMember } from '../types/family'

const KEY = 'baby-growth-family-demo-v1'
type DemoDB = Record<string, Record<string, Record<string, any>>>
const rows = (db: DemoDB, c: string) => Object.values(db[c] || {})
function demoDB(): DemoDB {
  const old = Taro.getStorageSync(KEY)
  if (old) return old
  const session = Taro.getStorageSync('baby-growth-demo-session') as BootstrapResult | undefined
  const id = session?.user.id || 'demo-user',
    stamp = new Date().toISOString(),
    db: DemoDB = {
      users: {
        [id]: {
          _id: id,
          nickname: session?.user.nickname || '我',
          createdAt: stamp,
          activeFamilyId: session?.family?.id || '',
        },
      },
      families: {},
      family_members: {},
      children: {},
    }
  if (session?.family) {
    db.families[session.family.id] = { ...session.family, _id: session.family.id, status: 'active' }
    const mid = `${session.family.id}_${id}`
    db.family_members[mid] = {
      _id: mid,
      familyId: session.family.id,
      userId: id,
      role: session.currentRole || 'owner',
      status: 'active',
      displayName: '我',
      joinedAt: stamp,
    }
  }
  session?.children.forEach((c) => {
    db.children[c.id] = {
      ...c,
      _id: c.id,
      scope: session.family ? 'family' : 'personal',
      createdBy: id,
    }
  })
  Taro.setStorageSync(KEY, db)
  return db
}
export function demoSession(): BootstrapResult {
  const db = demoDB(),
    user = rows(db, 'users')[0],
    member = rows(db, 'family_members').find((m) => m.userId === user._id && m.status === 'active'),
    family = member ? db.families[member.familyId] : undefined
  const personal = rows(db, 'children').filter(
    (c) => c.createdBy === user._id && c.scope === 'personal',
  )
  const children = family ? rows(db, 'children').filter((c) => c.familyId === family._id) : personal
  const map = (r: Record<string, any>) => ({ ...r, id: r._id })
  return {
    user: {
      ...user,
      id: user._id,
      nickname: user.nickname || '我',
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString(),
    },
    family: family ? (map(family) as BootstrapResult['family']) : undefined,
    membership: member ? (map(member) as unknown as FamilyMember) : undefined,
    currentRole: member?.role,
    personalChildren: personal.map(map) as BootstrapResult['children'],
    children: children.map(map) as BootstrapResult['children'],
    currentChildId: children[0]?._id,
    isDemo: true,
  }
}
export function restoreChildSelection(session: BootstrapResult): BootstrapResult {
  const id = Taro.getStorageSync(
    `baby-growth-last-child-${session.user.id}-${session.family?.id || 'personal'}`,
  )
  return session.children.some((child) => child.id === id)
    ? { ...session, currentChildId: id }
    : session
}
let refreshPending: Promise<BootstrapResult> | undefined
export function refreshFamilySession(): Promise<BootstrapResult> {
  if (!refreshPending)
    refreshPending = loadFamilySession().finally(() => {
      refreshPending = undefined
    })
  return refreshPending
}
async function loadFamilySession() {
  const session = restoreChildSelection(
    isCloudConfigured() ? await callCloudFunction<BootstrapResult>('login') : demoSession(),
  )
  const current = useSessionStore.getState(),
    changed = current.familyId !== session.family?.id
  const childId =
    !changed && session.children.some((c) => c.id === current.childId)
      ? current.childId
      : session.currentChildId
  const stableChildren =
    JSON.stringify(current.children) === JSON.stringify(session.children)
      ? current.children
      : session.children
  current.setSession({
    ...session,
    children: stableChildren,
    family: session.family,
    familyId: session.family?.id,
    userId: session.user.id,
    currentRole: session.currentRole,
    membership: session.membership,
    childId,
    sessionError: undefined,
    membershipIssue: session.membershipIssue,
  })
  if (changed) {
    for (const key of [
      'baby-growth-home-records-refresh',
      'baby-growth-growth-records-refresh',
      'baby-growth-records-updated',
    ])
      Taro.setStorageSync(key, true)
  }
  if (!isCloudConfigured())
    Taro.setStorageSync('baby-growth-demo-session', { ...session, currentChildId: childId })
  return session
}
const operation = () => `op_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
let mutationBusy = false
const retryOperations = new Map<string, string>()
export async function familyAction<T = Record<string, any>>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const read = ['overview', 'previewInvite'].includes(action)
  if (!read && mutationBusy) throw new Error('REQUEST_PENDING')
  if (!read) mutationBusy = true
  const signature = JSON.stringify([
    useSessionStore.getState().userId,
    useSessionStore.getState().familyId,
    action,
    data,
  ])
  const operationId = retryOperations.get(signature) || operation()
  if (!read) retryOperations.set(signature, operationId)
  try {
    const state = useSessionStore.getState(),
      input = { familyId: state.familyId, ...data, action, operationId }
    let response: any
    if (isCloudConfigured()) response = await callCloudFunction('familyAction', input)
    else {
      const db = JSON.parse(JSON.stringify(demoDB())) as DemoDB,
        user = rows(db, 'users')[0]
      const team = rows(db, 'family_members').filter(
        (m) => m.familyId === state.familyId && m.status === 'active',
      )
      if (action === 'overview')
        response = {
          personalChildren: rows(db, 'children')
            .filter((c) => c.scope === 'personal' && c.createdBy === user._id)
            .map((c) => ({ ...c, id: c._id })),
          members: team.map((m) => ({ ...m, id: m._id })),
          requests: rows(db, 'family_requests')
            .filter((r) => r.userId === user._id)
            .map((r) => ({ ...r, id: r._id })),
          familyRequests: isManager(state.currentRole)
            ? rows(db, 'family_requests')
                .filter((r) => r.familyId === state.familyId && r.status === 'pending')
                .map((r) => ({ ...r, id: r._id }))
            : [],
          invitations: isManager(state.currentRole)
            ? rows(db, 'family_invitations')
                .filter((i) => i.familyId === state.familyId && i.status === 'active')
                .map((i) => ({ ...i, id: i._id }))
            : [],
        }
      else if (action === 'previewInvite') {
        const invite = db.family_invitations?.[String(data.code).trim().toUpperCase()]
        if (!invite || invite.status !== 'active' || invite.expiresAt < new Date().toISOString())
          throw new Error('INVITATION_EXPIRED')
        response = {
          name: db.families[invite.familyId].name,
          occupied: rows(db, 'family_identity_slots')
            .filter((s) => s.familyId === invite.familyId)
            .map((s) => s.relationshipCode),
        }
      } else {
        const port: FamilyPort = {
          get: async (c, id) => db[c]?.[id],
          put: async (c, id, value) => {
            db[c] ||= {}
            db[c][id] = { ...value, _id: id }
          },
          remove: async (c, id) => {
            delete db[c]?.[id]
          },
        }
        const event: Record<string, any> = {
          ...input,
          operationId: `${user._id}_${input.operationId}`,
        }
        if (action === 'createInvite') {
          event.code = `LOCAL${Math.random().toString(36).slice(2, 10).toUpperCase()}`
          event.inviteId = event.code
        }
        if (action === 'join') event.inviteId = String(data.code).trim().toUpperCase()
        response = await mutateFamily(port, user._id, event, state.membership?.id)
        Taro.setStorageSync(KEY, db)
      }
    }
    if (!read) {
      const session = await refreshFamilySession()
      if (action === 'savePersonalChild' && !session.family && response.id)
        useSessionStore.getState().setCurrentChild(response.id)
    }
    if (!read) retryOperations.delete(signature)
    return response as T
  } finally {
    if (!read) mutationBusy = false
  }
}
export const getFamilyOverview = () => familyAction<FamilyOverview>('overview')
export function familyError(error: unknown) {
  const message = String(
    (error as { message?: string; errMsg?: string })?.message ||
      (error as { errMsg?: string })?.errMsg ||
      error,
  )
  const errors: Record<string, string> = {
    IDENTITY_OCCUPIED: '该身份已被使用，请选择其他身份',
    FAMILY_ALREADY_LINKED: '你已关联家庭，请先退出原家庭',
    REQUEST_PENDING: '已有操作或申请正在处理中',
    OWNER_REQUIRED: '此操作仅家庭创建者可执行',
    OWNER_TRANSFER_REQUIRED: '请先转让创建者，再退出家庭',
    SELF_REVIEW_FORBIDDEN: '不能审批自己的申请，请交由其他管理员处理',
    REQUEST_CONFLICT: '申请或成员状态已变化，请刷新后重试',
    INVALID_IDENTITY: '请选择一种家庭身份',
    INVITATION_REVOKED: '邀请无效或已撤销，请重新获取',
    INVITATION_EXPIRED: '邀请已过期，请重新获取',
    INVITATION_LIMIT_REACHED: '邀请次数已用完',
    INVALID_TEXT: '请填写有效内容',
    INVALID_CHILD: '请填写有效的宝宝昵称、出生日期和性别',
    FORBIDDEN: '没有操作权限，请刷新家庭身份',
    MULTIPLE_FAMILIES: '旧账号关联了多个家庭，请在家庭页整理归属',
    IDENTITY_ALREADY_SET: '请选择与当前不同的家庭身份',
  }
  return (
    Object.entries(errors).find(([code]) => message.includes(code))?.[1] ||
    '操作失败，请检查网络后重试'
  )
}
