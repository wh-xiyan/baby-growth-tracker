import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: Record<string, unknown>) {
  const openid = context(); const familyId = String(event.familyId || ''); const member = await activeMember(familyId, openid); if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.childId || !event.fileId || !event.fileType) throw new Error('INVALID_MEDIA')
  const created = await db.collection('media_assets').add({ data: { ...event, familyId, uploadedBy: member.userId, createdAt: now() } }); return result({ id: created._id })
}
