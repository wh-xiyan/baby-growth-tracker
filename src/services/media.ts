import Taro from '@tarojs/taro'
import { callCloudFunction, isCloudConfigured } from './cloud'

const isDirectMediaUrl = (fileId: string) =>
  fileId.startsWith('http://') ||
  fileId.startsWith('https://') ||
  fileId.startsWith('wxfile://') ||
  fileId.startsWith('/')

export async function resolveMediaUrl(
  familyId: string,
  fileId: string,
): Promise<string | undefined> {
  return (await resolveMediaUrls(familyId, [fileId]))[0]
}

export async function resolveMediaUrls(familyId: string, fileIds: string[]): Promise<string[]> {
  const uniqueFileIds = [...new Set(fileIds.filter(Boolean))]
  if (!uniqueFileIds.length) return []
  const resolvedUrls = new Map(
    uniqueFileIds
      .filter((fileId) => isDirectMediaUrl(fileId) || !isCloudConfigured())
      .map((fileId) => [fileId, fileId]),
  )
  const cloudFileIds = uniqueFileIds.filter((fileId) => !resolvedUrls.has(fileId))
  if (!cloudFileIds.length)
    return fileIds.map((fileId) => resolvedUrls.get(fileId)).filter(isResolvedMediaUrl)
  const urls = await callCloudFunction<Array<{ fileId: string; tempFileURL: string }>>(
    'getMediaTempUrls',
    { familyId, fileIds: cloudFileIds },
  )
  for (const item of urls) resolvedUrls.set(item.fileId, item.tempFileURL)
  return fileIds.map((fileId) => resolvedUrls.get(fileId)).filter(isResolvedMediaUrl)
}

function isResolvedMediaUrl(url: string | undefined): url is string {
  return Boolean(url)
}

export async function uploadMediaAsset(input: {
  familyId: string
  childId: string
}): Promise<{ fileId: string; fileType: 'image' | 'video'; mediaId?: string }> {
  const chosen = await Taro.chooseMedia({
    count: 1,
    mediaType: ['image', 'video'],
    sourceType: ['album', 'camera'],
  })
  const file = chosen.tempFiles[0]
  if (!file) throw new Error('MEDIA_NOT_SELECTED')
  const fileType = file.fileType === 'video' ? 'video' : 'image'
  if (!isCloudConfigured()) return { fileId: file.tempFilePath, fileType }
  const uploaded = await Taro.cloud.uploadFile({
    cloudPath: `media/${input.familyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filePath: file.tempFilePath,
  })
  const metadata = await callCloudFunction<{ id: string }>('createMediaAsset', {
    ...input,
    fileId: uploaded.fileID,
    fileType,
    size: file.size,
    duration: file.duration,
  })
  return { fileId: uploaded.fileID, fileType, mediaId: metadata.id }
}
