import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: {
  familyId?: string
  vaccineId?: string
  data?: Record<string, unknown>
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, openid)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.vaccineId || !event.data) throw new Error('INVALID_VACCINE')
  await db
    .collection('vaccines')
    .doc(event.vaccineId)
    .update({ data: { ...event.data, updatedAt: now() } })
  return result({ id: event.vaccineId })
}
