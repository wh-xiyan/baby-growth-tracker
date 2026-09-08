import { db, now, context, result } from '../../shared/db'

export async function main() {
  const openid = context()
  const found = await db.collection('users').where({ openid }).limit(1).get()
  let user = found.data[0]
  if (!user) {
    const created = await db
      .collection('users')
      .add({ data: { openid, nickname: '', createdAt: now(), updatedAt: now() } })
    user = { _id: created._id, openid, nickname: '' }
  }
  const memberships = await db
    .collection('family_members')
    .where({ userId: user._id, status: 'active' })
    .get()
  const families = memberships.data.length
    ? (
        await db
          .collection('families')
          .where({
            _id: db.command.in(memberships.data.map((m: Record<string, any>) => m.familyId)),
          })
          .get()
      ).data
    : []
  const family = families[0]
  const children = family
    ? (
        await db
          .collection('children')
          .where({ familyId: family._id })
          .orderBy('createdAt', 'asc')
          .get()
      ).data
    : []
  return result({
    user: { id: user._id, nickname: user.nickname || '' },
    family: family && { id: family._id, name: family.name, ownerId: family.ownerId },
    children: children.map((child: Record<string, any>) => ({ ...child, id: child._id })),
    currentChildId: children[0]?._id,
    isDemo: false,
  })
}
