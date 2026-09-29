import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: Record<string, unknown>) {
  const openid = context()
  const familyId = String(event.familyId || '')
  const member = await activeMember(familyId, openid)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.childId || !event.fileId || !event.fileType) throw new Error('INVALID_MEDIA')
  const child = await db
    .collection('children')
    .where({ _id: event.childId, familyId })
    .limit(1)
    .get()
  if (!child.data[0]) throw new Error('CHILD_NOT_FOUND')
  const created = await db.collection('media_assets').add({
    data: {
      familyId,
      childId: event.childId,
      fileId: event.fileId,
      fileType: event.fileType,
      recordId: event.recordId || '',
      caption: event.caption || '',
      size: event.size || 0,
      duration: event.duration || 0,
      uploadedBy: member.userId,
      createdAt: now(),
    },
  })
  return result({ id: created._id })
}
