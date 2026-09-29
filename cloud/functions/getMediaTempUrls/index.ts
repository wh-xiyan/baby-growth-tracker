import cloud from 'wx-server-sdk'
import { db, context, activeMember, result } from '../../shared/db'

export async function main(event: { familyId?: string; fileIds?: string[] }) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const fileIds = Array.isArray(event?.fileIds) ? event.fileIds.filter(Boolean).slice(0, 50) : []
  if (!familyId || !fileIds.length) throw new Error('INVALID_MEDIA_QUERY')
  await activeMember(familyId, openid)
  const assets = await db
    .collection('media_assets')
    .where({ familyId, fileId: db.command.in(fileIds), deletedAt: db.command.exists(false) })
    .get()
  const urls = await cloud.getTempFileURL({
    fileList: assets.data.map((item: Record<string, any>) => item.fileId),
  })
  return result(
    urls.fileList.map((item: { fileID: string; tempFileURL: string }) => ({
      fileId: item.fileID,
      tempFileURL: item.tempFileURL,
    })),
  )
}
