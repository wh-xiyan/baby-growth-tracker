import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: Record<string, unknown>) {
  const openid = context(); const familyId = String(event.familyId || ''); if (!familyId) throw new Error('INVALID_FAMILY')
  const member = await activeMember(familyId, openid); if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.childId || !event.category || !event.title || !event.occurredAt) throw new Error('INVALID_RECORD')
  const timestamp = now(); const created = await db.collection('growth_records').add({ data: { ...event, familyId, mediaFileIds: event.mediaFileIds || [], createdBy: member.userId, createdAt: timestamp, updatedAt: timestamp } })
  return result({ id: created._id })
}
