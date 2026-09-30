import { Image, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { resolveMediaUrl, resolveMediaUrls } from '../../services/media'

export function MediaThumbnail({
  familyId,
  fileId,
  className,
}: {
  familyId: string
  fileId?: string
  className: string
}) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    let active = true
    if (!fileId) {
      setUrl(undefined)
      return () => {
        active = false
      }
    }
    resolveMediaUrl(familyId, fileId)
      .then((resolvedUrl) => {
        if (active) setUrl(resolvedUrl)
      })
      .catch((error) => {
        console.error('加载媒体缩略图失败', error)
        if (active) setUrl(undefined)
      })
    return () => {
      active = false
    }
  }, [familyId, fileId])

  if (!url) return null
  return (
    <Image
      className={className}
      src={url}
      mode='aspectFill'
      onClick={(event) => {
        event.stopPropagation()
        Taro.previewImage({ current: url, urls: [url] }).catch((error) => {
          console.error('预览媒体图片失败', error)
        })
      }}
    />
  )
}

export function MediaThumbnails({
  familyId,
  fileIds,
  className,
  containerClassName,
  maxVisible,
  thumbnailItemClassName,
  moreClassName,
}: {
  familyId: string
  fileIds: string[]
  className: string
  containerClassName: string
  maxVisible?: number
  thumbnailItemClassName?: string
  moreClassName?: string
}) {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    let active = true
    resolveMediaUrls(familyId, fileIds)
      .then((resolvedUrls) => {
        if (active) setUrls(resolvedUrls)
      })
      .catch((error) => {
        console.error('加载媒体缩略图失败', error)
        if (active) setUrls([])
      })
    return () => {
      active = false
    }
  }, [familyId, fileIds])

  if (!urls.length) return null
  const visibleUrls = maxVisible ? urls.slice(0, maxVisible) : urls
  const remainingCount = urls.length - visibleUrls.length
  return (
    <View className={containerClassName}>
      {visibleUrls.map((url, index) => (
        <View
          className={thumbnailItemClassName}
          key={url}
          onClick={(event) => {
            event.stopPropagation()
            Taro.previewImage({ current: url, urls }).catch((error) => {
              console.error('预览媒体图片失败', error)
            })
          }}
        >
          <Image className={className} src={url} mode='aspectFill' />
          {remainingCount > 0 && index === visibleUrls.length - 1 && moreClassName && (
            <View className={moreClassName}>+{remainingCount}</View>
          )}
        </View>
      ))}
    </View>
  )
}
