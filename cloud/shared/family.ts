import { createHash, randomBytes } from 'crypto'
import { db, context, result } from './db'
import { mutateFamily, type FamilyPort, isManager } from '../../src/domain/family'
const hash = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
export async function getDoc(store: any, collection: string, id: string) {
  if (!id) return undefined
  // Queries are used only outside transactions. Transactions read deterministic document ids.
  try {
    const value = await store.collection(collection).doc(id).get()
    return value.data && { ...value.data, _id: id }
  } catch (error: any) {
    if (/not exist|not found|does not exist/i.test(error.message || error.errMsg || ''))
      return undefined
    throw error
  }
}
export async function all(collection: string, filter: Record<string, any>) {
  const items: any[] = []
  let cursor = ''
  for (;;) {
    const page = await db
      .collection(collection)
      .where({ ...filter, ...(cursor ? { _id: db.command.gt(cursor) } : {}) })
      .orderBy('_id', 'asc')
      .limit(100)
      .get()
    items.push(...page.data)
    if (page.data.length < 100) return items
    cursor = page.data[page.data.length - 1]._id
  }
}
export async function trustedUser() {
  const found = await db.collection('users').where({ openid: context() }).limit(1).get()
  if (!found.data[0]) throw new Error('USER_NOT_FOUND')
  return found.data[0]
}
export async function sessionFor(user: any) {
  const memberships = await all('family_members', { userId: user._id, status: 'active' })
  const ambiguous = memberships.length > 1
  const membership =
    memberships.find((m) => m.familyId === user.activeFamilyId) ||
    (!ambiguous ? memberships[0] : undefined)
  const family = membership ? await getDoc(db, 'families', membership.familyId) : undefined
  const personal = await all('children', { createdBy: user._id, scope: 'personal' })
  const children = family ? await all('children', { familyId: family._id }) : personal
  return {
    user: {
      id: user._id,
      nickname: user.nickname || '我',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    family: family ? { ...family, id: family._id, inviteCode: undefined } : undefined,
    children: children.map((c) => ({
      ...c,
      id: c._id,
      birthday:
        typeof c.birthday === 'string'
          ? c.birthday
          : new Date(c.birthday).toISOString().slice(0, 10),
    })),
    personalChildren: personal.map((c) => ({ ...c, id: c._id })),
    currentChildId: children.find((c) => c._id === user.lastChildId)?._id || children[0]?._id,
    currentRole: membership?.role,
    membership: membership ? { ...membership, id: membership._id } : undefined,
    membershipIssue: ambiguous ? 'MULTIPLE_FAMILIES' : undefined,
    isDemo: false,
  }
}
export async function familyMain(event: Record<string, any>) {
  const user = await trustedUser(),
    action = String(event.action || ''),
    members = await all('family_members', { userId: user._id, status: 'active' })
  if (members.length > 1 && !['overview', 'setLegacyContext', 'transfer', 'leave'].includes(action))
    throw new Error('MULTIPLE_FAMILIES')
  const member = members.find(
    (m) => m.familyId === (event.familyId || user.activeFamilyId || members[0]?.familyId),
  )
  const familyId = String(event.familyId || member?.familyId || '')
  if (action === 'previewInvite') {
    const invite = await getDoc(db, 'family_invitations', hash(String(event.code || '')))
    if (!invite || invite.status !== 'active') throw new Error('INVITATION_REVOKED')
    if (new Date(invite.expiresAt).getTime() < Date.now()) throw new Error('INVITATION_EXPIRED')
    if (invite.usedCount >= invite.maxUses) throw new Error('INVITATION_LIMIT_REACHED')
    const family = await getDoc(db, 'families', invite.familyId)
    if (!family || (family.status && family.status !== 'active')) throw new Error('NOT_FOUND')
    const slots = await all('family_identity_slots', { familyId: invite.familyId })
    return result({ name: family.name, occupied: slots.map((s) => s.relationshipCode) })
  }
  if (action === 'overview') {
    const legacyFamilies =
      members.length > 1
        ? await Promise.all(
            members.map(async (m) => {
              const f = await getDoc(db, 'families', m.familyId)
              return { id: m.familyId, name: f?.name || '旧家庭', role: m.role }
            }),
          )
        : []
    const personal = await all('children', { createdBy: user._id, scope: 'personal' })
    const own = await all('family_requests', { userId: user._id })
    if (!member)
      return result({
        legacyFamilies,
        personalChildren: personal.map((c) => ({ ...c, id: c._id })),
        requests: own.map((r) => ({ ...r, id: r._id })),
        members: [],
        invitations: [],
        familyRequests: [],
      })
    const team = await all('family_members', { familyId, status: 'active' })
    const invitations = isManager(member.role)
      ? await all('family_invitations', { familyId, status: 'active' })
      : []
    const pending = isManager(member.role)
      ? await all('family_requests', { familyId, status: 'pending' })
      : []
    return result({
      legacyFamilies,
      personalChildren: personal.map((c) => ({ ...c, id: c._id })),
      members: team.map((m) => ({ ...m, id: m._id })),
      requests: own.map((r) => ({ ...r, id: r._id })),
      familyRequests: pending.map((r) => ({ ...r, id: r._id })),
      invitations: invitations.map((i) => ({
        id: i._id,
        expiresAt: i.expiresAt,
        usedCount: i.usedCount,
        maxUses: i.maxUses,
      })),
    })
  }
  const operationId = String(event.operationId || '')
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(operationId)) throw new Error('INVALID_OPERATION_ID')
  const input: Record<string, any> = {
    ...event,
    familyId,
    operationId: hash(`${user._id}|${operationId}`),
  }
  if (action === 'createInvite') {
    input.code = randomBytes(12).toString('hex').toUpperCase()
    input.inviteId = hash(input.code)
  }
  if (action === 'join') input.inviteId = hash(String(event.code || ''))
  const response = await db.runTransaction(async (transaction: any) => {
    const port: FamilyPort = {
      get: (c, id) => getDoc(transaction, c, id),
      put: async (c, id, data) => {
        const { _id, ...clean } = data
        await transaction.collection(c).doc(id).set({ data: clean })
      },
      remove: async (c, id) => {
        await transaction.collection(c).doc(id).remove()
      },
    }
    const current = await port.get('users', user._id)
    // Old single-family accounts acquire the same per-user lock as new accounts.
    if (member && !current?.activeFamilyId) {
      await port.put('users', user._id, { ...current, activeFamilyId: member.familyId })
    }
    const receiptId = `${user._id}_${operationId}`
    const receipt = await port.get('family_operations', receiptId)
    if (receipt) {
      if (receipt.action !== action) throw new Error('INVALID_OPERATION_ID')
      return receipt.response
    }
    if (action === 'setLegacyContext') {
      const selected = members.find((m) => m.familyId === event.targetId)
      const latest = selected ? await port.get('family_members', selected._id) : undefined
      if (!latest || latest.status !== 'active' || latest.userId !== user._id)
        throw new Error('FORBIDDEN')
      await port.put('users', user._id, { ...current, activeFamilyId: event.targetId })
      return { id: event.targetId }
    }
    const response = await mutateFamily(port, user._id, input, member?._id)
    await port.put('family_operations', receiptId, {
      userId: user._id,
      action,
      response: action === 'createInvite' ? { inviteCreated: true } : response,
      createdAt: new Date().toISOString(),
    })
    return response
  })
  return result(response)
}
