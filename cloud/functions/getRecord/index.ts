import { db, context, activeMember, result } from '../../shared/db'
import { recordAuthors } from '../../shared/record-authors'
import { ownedDocument } from '../../shared/records'
export async function main(event: { familyId?: string; childId?: string; recordId?: string }) {
  const familyId = String(event.familyId || '')
  await activeMember(familyId, context())
  if (!event.recordId || !event.childId) throw new Error('INVALID_RECORD')
  const record = await ownedDocument('growth_records', event.recordId, familyId)
  if (record.childId !== event.childId) throw new Error('NOT_FOUND')
  const media = record.mediaFileIds?.length
    ? await db
        .collection('media_assets')
        .where({
          familyId,
          childId: event.childId,
          fileId: db.command.in(record.mediaFileIds),
          deletedAt: db.command.exists(false),
        })
        .get()
    : { data: [] }
  const authors = await recordAuthors(familyId, [record])
  return result({
    media: (record.mediaFileIds || []).map((fileId: string) => ({
      fileId,
      fileType:
        media.data.find((asset: Record<string, any>) => asset.fileId === fileId)?.fileType ||
        'unknown',
    })),
    ...record,
    id: record._id,
    version: record.version || 0,
    authorName: authors.get(record.createdBy) || '家庭成员',
    occurredAt: new Date(record.occurredAt).toISOString(),
  })
}
