import { db, now, context, result } from '../../shared/db'
export async function main(event: { inviteCode?: string; displayName?: string }) {
  const openid = context(); const code = event?.inviteCode?.trim().toUpperCase(); if (!code) throw new Error('INVALID_INVITE_CODE')
  const user = await db.collection('users').where({ openid }).limit(1).get(); if (!user.data[0]) throw new Error('USER_NOT_FOUND')
  const family = await db.collection('families').where({ inviteCode: code }).limit(1).get(); if (!family.data[0]) throw new Error('FAMILY_NOT_FOUND')
  const existing = await db.collection('family_members').where({ familyId: family.data[0]._id, userId: user.data[0]._id }).limit(1).get()
  if (existing.data[0]?.status === 'active') throw new Error('ALREADY_MEMBER')
  const data = { familyId: family.data[0]._id, userId: user.data[0]._id, role: 'adult', displayName: event.displayName?.trim() || user.data[0].nickname || '家庭成员', status: 'active', joinedAt: now(), updatedAt: now() }
  if (existing.data[0]) await db.collection('family_members').doc(existing.data[0]._id).update({ data })
  else await db.collection('family_members').add({ data })
  return result({ id: family.data[0]._id, name: family.data[0].name })
}
