import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: Record<string, unknown>) {
  const openid = context(); const familyId = String(event.familyId || ''); const member = await activeMember(familyId, openid); if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.childId || !event.name || !event.plannedDate) throw new Error('INVALID_VACCINE')
  const timestamp = now(); const created = await db.collection('vaccines').add({ data: { ...event, familyId, status: event.status || 'planned', reminderEnabled: event.reminderEnabled !== false, createdAt: timestamp, updatedAt: timestamp } }); return result({ id: created._id })
}
