import Taro from '@tarojs/taro'
import { callCloudFunction, isCloudConfigured } from './cloud'

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
