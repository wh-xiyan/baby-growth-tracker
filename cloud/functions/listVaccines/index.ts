import { db, context, activeMember, result } from '../../shared/db'
export async function main(event: { familyId?: string; childId?: string }) {
  const openid = context(); const familyId = String(event?.familyId || ''); await activeMember(familyId, openid)
  const where: Record<string, unknown> = { familyId }; if (event.childId) where.childId = event.childId
  const vaccines = await db.collection('vaccines').where(where).orderBy('plannedDate', 'asc').get(); return result(vaccines.data.map((item) => ({ ...item, id: item._id })))
}
