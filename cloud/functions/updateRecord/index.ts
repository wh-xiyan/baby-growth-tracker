import { assertRecordManager, assertVersion, validateGrowthDate } from '../../shared/growth'
import { ownedDocument, validateRecord, validateRecordMedia } from '../../shared/records'
import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: {
  familyId?: string
  recordId?: string
  data?: Record<string, unknown>
  expectedVersion?: number
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, openid)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.recordId || !event.data) throw new Error('INVALID_RECORD')
  const existing = await ownedDocument('growth_records', event.recordId, familyId)
  assertRecordManager(member, existing)
  assertVersion(existing, event.expectedVersion)
  const allowed = ['category', 'title', 'occurredAt', 'content', 'metrics', 'mediaFileIds']
  if (Object.keys(event.data).some((key) => !allowed.includes(key)))
    throw new Error('INVALID_FIELDS')
  const validated = validateRecord({ ...existing, ...event.data })
  const child = await ownedDocument('children', existing.childId, familyId)
  validateGrowthDate(validated, child.birthday)
  await validateRecordMedia(familyId, existing.childId, validated.mediaFileIds)
  const updated = await db
    .collection('growth_records')
    .where({
      _id: event.recordId,
      familyId,
      deletedAt: db.command.exists(false),
      version: existing.version ?? db.command.exists(false),
    })
    .update({ data: { ...validated, version: (existing.version || 0) + 1, updatedAt: now() } })
  if (updated.stats.updated !== 1) throw new Error('RECORD_CONFLICT')
  return result({ id: event.recordId })
}
