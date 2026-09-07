import { db, now, context, result } from '../../shared/db'

function inviteCode() { return Math.random().toString(36).slice(2, 8).toUpperCase() }
export async function main(event: { name?: string }) {
  const openid = context()
  const name = event?.name?.trim()
  if (!name) throw new Error('INVALID_FAMILY_NAME')
  const user = await db.collection('users').where({ openid }).limit(1).get()
  if (!user.data[0]) throw new Error('USER_NOT_FOUND')
  const timestamp = now()
  const created = await db.collection('families').add({ data: { name, ownerId: user.data[0]._id, inviteCode: inviteCode(), createdAt: timestamp, updatedAt: timestamp } })
  await db.collection('family_members').add({ data: { familyId: created._id, userId: user.data[0]._id, role: 'owner', displayName: user.data[0].nickname || '创建者', status: 'active', joinedAt: timestamp } })
  return result({ id: created._id, name })
}
