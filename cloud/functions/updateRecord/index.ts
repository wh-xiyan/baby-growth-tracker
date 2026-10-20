import { ownedDocument, validateRecord, validateRecordMedia } from '../../shared/records'
import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: {
  familyId?: string
  recordId?: string
  data?: Record<string, unknown>
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, openid)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.recordId || !event.data) throw new Error('INVALID_RECORD')
  const existing = await ownedDocument('growth_records', event.recordId, familyId)
  const allowed = ['category', 'title', 'occurredAt', 'content', 'metrics', 'mediaFileIds']
  if (Object.keys(event.data).some((key) => !allowed.includes(key)))
    throw new Error('INVALID_FIELDS')
  const validated = validateRecord({ ...existing, ...event.data })
  await validateRecordMedia(familyId, existing.childId, validated.mediaFileIds)
  await db
    .collection('growth_records')
    .doc(event.recordId)
    .update({ data: { ...validated, updatedAt: now() } })
  return result({ id: event.recordId })
}
