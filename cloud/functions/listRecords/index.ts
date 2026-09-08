import { db, context, activeMember, result } from '../../shared/db'
export async function main(event: {
  familyId?: string
  childId?: string
  category?: string
  limit?: number
  skip?: number
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  await activeMember(familyId, openid)
  const where: Record<string, unknown> = { familyId, deletedAt: db.command.exists(false) }
  if (event.childId) where.childId = event.childId
  if (event.category) where.category = event.category
  const records = await db
    .collection('growth_records')
    .where(where)
    .orderBy('occurredAt', 'desc')
    .skip(event.skip || 0)
    .limit(Math.min(event.limit || 20, 100))
    .get()
  return result(records.data.map((item: Record<string, any>) => ({ ...item, id: item._id })))
}
