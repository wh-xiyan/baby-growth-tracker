import cloud from 'wx-server-sdk'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
export const db = cloud.database()
export const _ = db.command
export const now = () => new Date()

export function context() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('UNAUTHENTICATED')
  return OPENID
}

export async function activeMember(familyId: string, openid: string, write = false) {
  const user = await db.collection('users').where({ openid }).limit(1).get()
  const userId = user.data[0]?._id
  if (!familyId || (user.data[0]?.activeFamilyId && user.data[0].activeFamilyId !== familyId))
    throw new Error('FORBIDDEN')
  if (!userId) throw new Error('USER_NOT_FOUND')
  const result = await db
    .collection('family_members')
    .where({ familyId, userId, status: 'active' })
    .limit(1)
    .get()
  if (!result.data[0] || !['owner', 'admin', 'adult', 'viewer'].includes(result.data[0].role))
    throw new Error('FORBIDDEN')
  if (write) {
    const memberships = await db
      .collection('family_members')
      .where({ userId, status: 'active' })
      .limit(2)
      .get()
    if (memberships.data.length > 1) throw new Error('MULTIPLE_FAMILIES')
  }
  return result.data[0]
}

export function result<T>(data: T) {
  return { ok: true, data }
}
