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

export async function activeMember(familyId: string, openid: string) {
  const user = await db.collection('users').where({ openid }).limit(1).get()
  const userId = user.data[0]?._id
  if (!userId) throw new Error('USER_NOT_FOUND')
  const result = await db
    .collection('family_members')
    .where({ familyId, userId, status: 'active' })
    .limit(1)
    .get()
  if (!result.data[0]) throw new Error('FORBIDDEN')
  return result.data[0]
}

export function result<T>(data: T) {
  return { ok: true, data }
}
