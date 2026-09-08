import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: { familyId?: string; recordId?: string }) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, openid)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.recordId) throw new Error('INVALID_RECORD')
  await db
    .collection('growth_records')
    .doc(event.recordId)
    .update({ data: { deletedAt: now(), updatedAt: now() } })
  return result({ id: event.recordId })
}
