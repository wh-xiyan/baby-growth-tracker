import { db, now, context, result } from '../../shared/db'
import { sessionFor } from '../../shared/family'
export async function main() {
  const openid = context(),
    found = await db.collection('users').where({ openid }).limit(1).get()
  let user = found.data[0]
  if (!user) {
    try {
      const created = await db
        .collection('users')
        .add({ data: { openid, nickname: '', createdAt: now(), updatedAt: now() } })
      user = { _id: created._id, openid, nickname: '' }
    } catch (error) {
      const again = await db.collection('users').where({ openid }).limit(1).get()
      if (!again.data[0]) throw error
      user = again.data[0]
    }
  }
  return result(await sessionFor(user))
}
