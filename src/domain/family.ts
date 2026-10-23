export const relationships = [
  '爸爸',
  '妈妈',
  '爷爷',
  '奶奶',
  '外公',
  '外婆',
  '照护者',
  '其他家人',
] as const
export type Relationship = (typeof relationships)[number]
export type Role = 'owner' | 'admin' | 'adult' | 'viewer'
export const roleLabels: Record<Role, string> = {
  owner: '创建者',
  admin: '管理员',
  adult: '普通成员',
  viewer: '只读成员',
}
export const isManager = (role?: string) => role === 'owner' || role === 'admin'
export const canWrite = (role?: string) => isManager(role) || role === 'adult'
export const canManage = (role: string | undefined, userId: string | undefined, author?: string) =>
  isManager(role) || (role === 'adult' && Boolean(userId) && author === userId)
export function defaultRole(identity: string): Role {
  if (!relationships.includes(identity as Relationship)) throw new Error('INVALID_IDENTITY')
  return ['爸爸', '妈妈'].includes(identity)
    ? 'admin'
    : identity === '其他家人'
      ? 'viewer'
      : 'adult'
}
export function childData(input: Record<string, any>) {
  const name = String(input.name || '').trim(),
    birthday = String(input.birthday || '').slice(0, 10)
  const time = new Date(birthday + 'T00:00:00Z')
  if (
    !name ||
    name.length > 50 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthday) ||
    !Number.isFinite(time.getTime()) ||
    time.toISOString().slice(0, 10) !== birthday ||
    birthday > new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  )
    throw new Error('INVALID_CHILD')
  if (!['male', 'female', 'unknown'].includes(input.gender || 'unknown'))
    throw new Error('INVALID_CHILD')
  return { name, birthday, gender: input.gender || 'unknown' }
}
export interface FamilyPort {
  get(collection: string, id: string): Promise<Record<string, any> | undefined>
  put(collection: string, id: string, data: Record<string, any>): Promise<void>
  remove(collection: string, id: string): Promise<void>
}
export const memberKey = (familyId: string, userId: string) => `${familyId}_${userId}`
export const slotKey = (familyId: string, identity: string) =>
  `${familyId}_${relationships.indexOf(identity as Relationship)}`
const text = (value: unknown, max = 30) => {
  const s = String(value || '').trim()
  if (!s || s.length > max) throw new Error('INVALID_TEXT')
  return s
}

/** All mutations run within one server transaction or a single local-demo commit. */
export async function mutateFamily(
  port: FamilyPort,
  userId: string,
  event: Record<string, any>,
  memberId?: string,
) {
  const get = port.get.bind(port),
    put = port.put.bind(port),
    remove = port.remove.bind(port)
  const user = await get('users', userId)
  if (!user) throw new Error('UNAUTHENTICATED')
  const action = String(event.action),
    stamp = new Date().toISOString(),
    familyId = String(event.familyId || user.activeFamilyId || '')
  const member = familyId
    ? await get('family_members', memberId || memberKey(familyId, userId))
    : undefined
  const family = familyId ? await get('families', familyId) : undefined
  const active = Boolean(
    member?.status === 'active' &&
      member.userId === userId &&
      member.familyId === familyId &&
      family &&
      ['owner', 'admin', 'adult', 'viewer'].includes(member.role) &&
      (!user.activeFamilyId || user.activeFamilyId === familyId),
  )
  const requireMember = () => {
    if (!active) throw new Error('FORBIDDEN')
  }
  const requireManager = () => {
    requireMember()
    if (!isManager(member?.role)) throw new Error('FORBIDDEN')
  }
  const updateUser = async (id: string, data: Record<string, any>) => {
    const u = await get('users', id)
    if (!u) throw new Error('NOT_FOUND')
    await put('users', id, {
      ...u,
      ...data,
      membershipVersion: (u.membershipVersion || 0) + 1,
      updatedAt: stamp,
    })
  }
  const occupy = async (f: string, identity: string, uid: string, mid: string) => {
    defaultRole(identity)
    const slot = await get('family_identity_slots', slotKey(f, identity))
    if (slot && slot.userId !== uid) throw new Error('IDENTITY_OCCUPIED')
    await put('family_identity_slots', slotKey(f, identity), {
      familyId: f,
      relationshipCode: identity,
      userId: uid,
      memberId: mid,
      updatedAt: stamp,
    })
  }
  const audit = async (f: string, detail: Record<string, any>) => {
    await put('family_audit_logs', `${userId}_${event.operationId}`, {
      familyId: f,
      actorId: userId,
      action,
      targetId: event.targetId || event.requestId || userId,
      ...detail,
      createdAt: stamp,
    })
  }
  const claimPending = async () => {
    if (user.pendingRequestId) {
      const r = await get('family_requests', user.pendingRequestId)
      if (r?.status === 'pending') throw new Error('REQUEST_PENDING')
    }
  }
  const request = async (type: string, payload: Record<string, any>, f = familyId) => {
    await claimPending()
    const id = event.operationId
    await put('family_requests', id, {
      familyId: f,
      userId,
      type,
      payload,
      status: 'pending',
      version: 1,
      createdAt: stamp,
    })
    await updateUser(userId, { pendingRequestId: id })
    return { id }
  }
  if (action === 'savePersonalChild') {
    const id = event.childId || event.operationId,
      existing = await get('children', id)
    if (existing && (existing.createdBy !== userId || existing.scope !== 'personal'))
      throw new Error('FORBIDDEN')
    await put('children', id, {
      ...existing,
      ...childData(event.data || {}),
      createdBy: userId,
      scope: 'personal',
      familyId: '',
      createdAt: existing?.createdAt || stamp,
      updatedAt: stamp,
    })
    return { id }
  }
  if (action === 'create') {
    if (user.activeFamilyId) throw new Error('FAMILY_ALREADY_LINKED')
    await claimPending()
    const id = event.operationId,
      old = await get('families', id)
    if (old?.ownerId === userId) return { id }
    if (old) throw new Error('INVALID_OPERATION_ID')
    const identity = text(event.identity),
      name = text(event.name),
      mid = memberKey(id, userId)
    await occupy(id, identity, userId, mid)
    await put('families', id, {
      name,
      inviteCode: `RESERVED_${id}`,
      ownerId: userId,
      status: 'active',
      version: 1,
      createdAt: stamp,
      updatedAt: stamp,
    })
    await put('family_members', mid, {
      familyId: id,
      userId,
      role: 'owner',
      relationshipCode: identity,
      displayName: identity,
      status: 'active',
      version: 1,
      joinedAt: stamp,
    })
    await updateUser(userId, { activeFamilyId: id, pendingRequestId: '' })
    if (event.childId) {
      const child = await get('children', event.childId)
      if (!child || child.scope !== 'personal' || child.createdBy !== userId)
        throw new Error('INVALID_CHILD')
      await put('children', event.childId, {
        ...child,
        scope: 'family',
        familyId: id,
        attachedBy: userId,
        attachedAt: stamp,
        updatedAt: stamp,
      })
    }
    await audit(id, { after: { name, identity, role: 'owner' } })
    return { id }
  }
  if (action === 'join') {
    if (user.activeFamilyId) throw new Error('FAMILY_ALREADY_LINKED')
    const invite = await get('family_invitations', event.inviteId)
    if (!invite || invite.status !== 'active') throw new Error('INVITATION_REVOKED')
    if (invite.expiresAt < stamp) throw new Error('INVITATION_EXPIRED')
    if (invite.usedCount >= invite.maxUses) throw new Error('INVITATION_LIMIT_REACHED')
    const targetFamily = await get('families', invite.familyId)
    if (!targetFamily || (targetFamily.status && targetFamily.status !== 'active'))
      throw new Error('NOT_FOUND')
    const identity = text(event.identity),
      r = defaultRole(identity)
    if (await get('family_identity_slots', slotKey(invite.familyId, identity)))
      throw new Error('IDENTITY_OCCUPIED')
    const created = await request(
      'join',
      {
        identity,
        role: r,
        displayName: text(event.label || identity, 20),
        inviteId: event.inviteId,
      },
      invite.familyId,
    )
    await put('family_invitations', event.inviteId, { ...invite, usedCount: invite.usedCount + 1 })
    return created
  }
  if (action === 'cancelRequest') {
    const r = await get('family_requests', event.requestId)
    if (!r || r.userId !== userId || r.status !== 'pending') throw new Error('REQUEST_CONFLICT')
    await put('family_requests', event.requestId, {
      ...r,
      status: 'cancelled',
      version: r.version + 1,
      reviewedAt: stamp,
    })
    if (user.pendingRequestId === event.requestId)
      await updateUser(userId, { pendingRequestId: '' })
    return { id: event.requestId }
  }
  requireMember()
  if (action === 'updateLabel') {
    await put('family_members', member!._id, {
      ...member,
      displayName: text(event.label, 20),
      version: (member!.version || 0) + 1,
      updatedAt: stamp,
    })
    await audit(familyId, { after: { label: event.label } })
    return {}
  }
  if (action === 'claimIdentity' || action === 'requestIdentity') {
    const identity = text(event.identity),
      nextRole = defaultRole(identity)
    if (action === 'claimIdentity' && member!.relationshipCode)
      throw new Error('IDENTITY_ALREADY_SET')
    if (identity === member!.relationshipCode) throw new Error('IDENTITY_ALREADY_SET')
    if (await get('family_identity_slots', slotKey(familyId, identity)))
      throw new Error('IDENTITY_OCCUPIED')
    if (action === 'claimIdentity' || member!.role === 'owner') {
      await occupy(familyId, identity, userId, member!._id)
      if (member!.relationshipCode)
        await remove('family_identity_slots', slotKey(familyId, member!.relationshipCode))
      await put('family_members', member!._id, {
        ...member,
        relationshipCode: identity,
        version: (member!.version || 0) + 1,
        updatedAt: stamp,
      })
      await audit(familyId, { after: { identity, role: member!.role } })
      return {}
    }
    return request('identity_change', {
      identity,
      role: nextRole,
      memberId: member!._id,
      memberVersion: member!.version || 0,
    })
  }
  if (action === 'requestChild') {
    const child = await get('children', event.childId)
    if (!child || child.scope !== 'personal' || child.createdBy !== userId)
      throw new Error('INVALID_CHILD')
    if (!isManager(member!.role)) return request('child_attach', { childId: event.childId })
    await put('children', event.childId, {
      ...child,
      scope: 'family',
      familyId,
      attachedBy: userId,
      attachedAt: stamp,
      updatedAt: stamp,
    })
    await audit(familyId, { targetId: event.childId })
    return {}
  }
  if (action === 'addChild') {
    requireManager()
    const id = event.operationId
    await put('children', id, {
      ...childData(event.data || {}),
      createdBy: userId,
      familyId,
      scope: 'family',
      createdAt: stamp,
      updatedAt: stamp,
    })
    await audit(familyId, { targetId: id })
    return { id }
  }
  if (action === 'review') {
    requireManager()
    if (typeof event.approve !== 'boolean') throw new Error('INVALID_REQUEST')
    const r = await get('family_requests', event.requestId)
    if (!r || r.familyId !== familyId || r.status !== 'pending' || r.version !== event.version)
      throw new Error('REQUEST_CONFLICT')
    if (r.userId === userId) throw new Error('SELF_REVIEW_FORBIDDEN')
    const applicant = await get('users', r.userId),
      existing = await get('family_members', r.payload.memberId || memberKey(familyId, r.userId))
    if (!applicant || applicant.pendingRequestId !== event.requestId)
      throw new Error('REQUEST_CONFLICT')
    const requestedRole = r.type === 'child_attach' ? 'viewer' : r.payload.role
    const approvedRole = event.role || requestedRole
    if (r.type !== 'child_attach' && !['admin', 'adult', 'viewer'].includes(approvedRole))
      throw new Error('INVALID_ROLE')
    if (
      (requestedRole === 'admin' || approvedRole === 'admin' || existing?.role === 'admin') &&
      member!.role !== 'owner'
    )
      throw new Error('OWNER_REQUIRED')
    if (event.approve) {
      if (r.type === 'join') {
        if (applicant.activeFamilyId) throw new Error('FAMILY_ALREADY_LINKED')
        const invite = await get('family_invitations', r.payload.inviteId)
        if (!invite || invite.status !== 'active' || invite.expiresAt < stamp)
          throw new Error('INVITATION_EXPIRED')
        const mid = memberKey(familyId, r.userId)
        await occupy(familyId, r.payload.identity, r.userId, mid)
        await put('family_members', mid, {
          familyId,
          userId: r.userId,
          role: approvedRole,
          relationshipCode: r.payload.identity,
          displayName: r.payload.displayName || r.payload.identity,
          status: 'active',
          version: (existing?.version || 0) + 1,
          joinedAt: stamp,
        })
        await updateUser(r.userId, { activeFamilyId: familyId, pendingRequestId: '' })
      } else {
        if (!existing || existing.status !== 'active' || applicant.activeFamilyId !== familyId)
          throw new Error('FORBIDDEN')
        if (r.type === 'identity_change') {
          if ((existing.version || 0) !== r.payload.memberVersion)
            throw new Error('REQUEST_CONFLICT')
          await occupy(familyId, r.payload.identity, r.userId, existing._id)
          if (existing.relationshipCode)
            await remove('family_identity_slots', slotKey(familyId, existing.relationshipCode))
          await put('family_members', existing._id, {
            ...existing,
            relationshipCode: r.payload.identity,
            role: approvedRole,
            permissionSource: 'identity_default',
            version: (existing.version || 0) + 1,
            updatedAt: stamp,
          })
        } else if (r.type === 'child_attach') {
          const child = await get('children', r.payload.childId)
          if (!child || child.scope !== 'personal' || child.createdBy !== r.userId)
            throw new Error('CHILD_ALREADY_ATTACHED')
          await put('children', r.payload.childId, {
            ...child,
            scope: 'family',
            familyId,
            attachedBy: userId,
            attachedAt: stamp,
            updatedAt: stamp,
          })
        } else throw new Error('INVALID_REQUEST')
        await updateUser(r.userId, { pendingRequestId: '' })
      }
    } else await updateUser(r.userId, { pendingRequestId: '' })
    await put('family_requests', event.requestId, {
      ...r,
      status: event.approve ? 'approved' : 'rejected',
      reviewedBy: userId,
      reviewedAt: stamp,
      version: r.version + 1,
      approvedRole: event.approve ? approvedRole : '',
    })
    await audit(familyId, {
      requestId: event.requestId,
      after: { approved: event.approve, role: approvedRole },
    })
    return {}
  }
  if (action === 'updateFamily') {
    requireManager()
    await put('families', familyId, {
      ...family,
      name: text(event.name),
      version: (family!.version || 0) + 1,
      updatedAt: stamp,
    })
    await audit(familyId, { before: { name: family!.name }, after: { name: event.name } })
    return {}
  }
  if (action === 'createInvite') {
    requireManager()
    await put('family_invitations', event.inviteId, {
      familyId,
      createdBy: userId,
      status: 'active',
      createdAt: stamp,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      maxUses: 10,
      usedCount: 0,
    })
    await audit(familyId, {})
    return { code: event.code }
  }
  if (action === 'revokeInvite') {
    requireManager()
    const invite = await get('family_invitations', event.inviteId)
    if (!invite || invite.familyId !== familyId) throw new Error('NOT_FOUND')
    await put('family_invitations', event.inviteId, { ...invite, status: 'revoked' })
    await audit(familyId, {})
    return {}
  }
  if (['role', 'remove', 'leave', 'transfer'].includes(action)) {
    const targetId = action === 'leave' ? member!._id : String(event.targetId || ''),
      target = await get('family_members', targetId)
    if (!target || target.familyId !== familyId || target.status !== 'active')
      throw new Error('NOT_FOUND')
    if (event.version !== undefined && (target.version || 0) !== event.version)
      throw new Error('REQUEST_CONFLICT')
    if (action !== 'leave') requireManager()
    if (action === 'transfer') {
      if (member!.role !== 'owner' || target.userId === userId) throw new Error('OWNER_REQUIRED')
      await put('family_members', targetId, {
        ...target,
        role: 'owner',
        version: (target.version || 0) + 1,
        updatedAt: stamp,
      })
      await put('family_members', member!._id, {
        ...member,
        role: 'admin',
        version: (member!.version || 0) + 1,
        updatedAt: stamp,
      })
      await put('families', familyId, {
        ...family,
        ownerId: target.userId,
        version: (family!.version || 0) + 1,
        updatedAt: stamp,
      })
      await updateUser(userId, {})
      await updateUser(target.userId, {})
    } else {
      if (target.role === 'owner') throw new Error('OWNER_TRANSFER_REQUIRED')
      if (action === 'role') {
        if (!['admin', 'adult', 'viewer'].includes(event.role)) throw new Error('INVALID_ROLE')
        if ((target.role === 'admin' || event.role === 'admin') && member!.role !== 'owner')
          throw new Error('OWNER_REQUIRED')
        await put('family_members', targetId, {
          ...target,
          role: event.role,
          permissionSource: 'manual',
          version: (target.version || 0) + 1,
          updatedAt: stamp,
        })
        await updateUser(target.userId, {})
      } else {
        if (action === 'remove' && target.role === 'admin' && member!.role !== 'owner')
          throw new Error('OWNER_REQUIRED')
        await put('family_members', targetId, {
          ...target,
          status: 'removed',
          removedAt: stamp,
          version: (target.version || 0) + 1,
        })
        if (target.relationshipCode)
          await remove('family_identity_slots', slotKey(familyId, target.relationshipCode))
        const u = await get('users', target.userId)
        if (u?.pendingRequestId) {
          const r = await get('family_requests', u.pendingRequestId)
          if (r?.status === 'pending')
            await put('family_requests', u.pendingRequestId, {
              ...r,
              status: 'cancelled',
              version: r.version + 1,
              reviewedAt: stamp,
            })
        }
        await updateUser(target.userId, { activeFamilyId: '', pendingRequestId: '' })
      }
    }
    await audit(familyId, {
      before: { role: target.role, status: target.status },
      after: { role: event.role || '', action },
    })
    return {}
  }
  throw new Error('INVALID_ACTION')
}
