import { validateGrowthDate } from '../../shared/growth'
import { validateRecord, validateRecordMedia } from '../../shared/records'
import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: Record<string, unknown>) {
  const openid = context()
  const familyId = String(event.familyId || '')
  if (!familyId) throw new Error('INVALID_FAMILY')
  const member = await activeMember(familyId, openid)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.childId || !event.category || !event.title || !event.occurredAt)
    throw new Error('INVALID_RECORD')
  const child = await db
    .collection('children')
    .where({ _id: event.childId, familyId })
    .limit(1)
    .get()
  if (!child.data[0]) throw new Error('CHILD_NOT_FOUND')
  const validated = validateRecord(event)
  validateGrowthDate(validated, child.data[0].birthday)
  await validateRecordMedia(familyId, String(event.childId), validated.mediaFileIds)
  const timestamp = now()
  const created = await db.collection('growth_records').add({
    data: {
      familyId,
      childId: event.childId,
      ...validated,
      createdBy: member.userId,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  })
  return result({ id: created._id })
}
