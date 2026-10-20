import { ownedDocument } from '../../shared/records'
import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: { familyId?: string; mediaId?: string }) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, openid)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.mediaId) throw new Error('INVALID_MEDIA')
  await ownedDocument('media_assets', event.mediaId, familyId)
  await db
    .collection('media_assets')
    .doc(event.mediaId)
    .update({ data: { deletedAt: now() } })
  return result({ id: event.mediaId })
}
