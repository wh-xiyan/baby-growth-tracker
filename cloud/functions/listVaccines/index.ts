import { db, context, activeMember, result } from '../../shared/db'
export async function main(event: { familyId?: string; childId?: string }) {
  const familyId = String(event?.familyId || '')
  await activeMember(familyId, context())
  const where: Record<string, unknown> = { familyId }
  if (event.childId) where.childId = event.childId
  const vaccines: Record<string, any>[] = []
  while (true) {
    const page = await db
      .collection('vaccines')
      .where(where)
      .orderBy('plannedDate', 'asc')
      .skip(vaccines.length)
      .limit(100)
      .get()
    vaccines.push(...page.data)
    if (page.data.length < 100) break
  }
  return result(vaccines.map((item) => ({ ...item, id: item._id })))
}
