import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: {
  familyId?: string
  childId?: string
  data?: Record<string, unknown>
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, openid)
  if (!['owner', 'adult'].includes(member.role)) throw new Error('FORBIDDEN')
  if (!event.childId || !event.data) throw new Error('INVALID_CHILD')
  await db
    .collection('children')
    .doc(event.childId)
    .update({ data: { ...event.data, updatedAt: now() } })
  return result({ id: event.childId })
}
