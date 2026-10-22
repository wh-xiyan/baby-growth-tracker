import { assertRecordManager, assertVersion } from '../../shared/growth'
import cloud from 'wx-server-sdk'
import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: {
  familyId?: string
  recordId?: string
  expectedVersion?: number
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, openid)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.recordId) throw new Error('INVALID_RECORD')
  const found = await db.collection('growth_records').doc(event.recordId).get()
  const existing = found.data
  if (!existing || existing.familyId !== familyId) throw new Error('NOT_FOUND')
  assertRecordManager(member, existing)
  const retryCleanup =
    existing.deletedAt &&
    existing.mediaCleanupPending &&
    event.expectedVersion === (existing.version || 0) - 1
  if (!retryCleanup) {
    if (existing.deletedAt) throw new Error('NOT_FOUND')
    assertVersion(existing, event.expectedVersion)
    const updated = await db
      .collection('growth_records')
      .where({
        _id: event.recordId,
        familyId,
        deletedAt: db.command.exists(false),
        version: existing.version ?? db.command.exists(false),
      })
      .update({
        data: {
          deletedAt: now(),
          updatedAt: now(),
          mediaCleanupPending: true,
          version: (existing.version || 0) + 1,
        },
      })
    if (updated.stats.updated !== 1) throw new Error('RECORD_CONFLICT')
  }
  // Only registered assets from this family/child may be physically removed.
  for (const fileId of [...new Set<string>(existing.mediaFileIds || [])]) {
    const shared = await db
      .collection('growth_records')
      .where({
        familyId,
        mediaFileIds: db.command.in([fileId]),
        deletedAt: db.command.exists(false),
      })
      .limit(1)
      .get()
    if (shared.data.length) continue
    const assets = await db
      .collection('media_assets')
      .where({
        familyId,
        childId: existing.childId,
        fileId,
        deletedAt: db.command.exists(false),
      })
      .get()
    if (!assets.data.length) continue
    try {
      if (fileId.startsWith('cloud://')) {
        const deleted = await cloud.deleteFile({ fileList: [fileId] })
        if (deleted.fileList.some((file: { status: number }) => file.status !== 0))
          throw new Error('MEDIA_DELETE_FAILED')
      }
      await db
        .collection('media_assets')
        .where({
          familyId,
          childId: existing.childId,
          fileId,
        })
        .update({ data: { deletedAt: now() } })
    } catch (error) {
      console.error('清理成长记录媒体失败，可重试删除', error)
      return result({ id: event.recordId, mediaCleanupPending: true })
    }
  }
  await db
    .collection('growth_records')
    .doc(event.recordId)
    .update({ data: { mediaCleanupPending: false } })
  return result({ id: event.recordId, mediaCleanupPending: false })
}
