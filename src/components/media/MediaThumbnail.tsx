import { Button, Image, Text, Video, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { previewMedia } from '../../services/media-preview'
import { resolveMediaUrl, resolveMediaUrls } from '../../services/media'

export function MediaThumbnail({
  familyId,
  fileId,
  className,
  fileType,
}: {
  familyId: string
  fileId?: string
  className: string
  fileType?: string
}) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setUrl(undefined)
    setFailed(false)
    if (!fileId) {
      setUrl(undefined)
      return () => {
        active = false
      }
    }
    resolveMediaUrl(familyId, fileId)
      .then((resolvedUrl) => {
        if (active) {
          setUrl(resolvedUrl)
          setFailed(!resolvedUrl)
        }
      })
      .catch((error) => {
        console.error('加载媒体缩略图失败', error)
        if (active) {
          setUrl(undefined)
          setFailed(true)
        }
      })
    return () => {
      active = false
    }
  }, [familyId, fileId, retry])

  if (failed)
    return (
      <View
        className={className}
        style={{ background: '#faf0d7', padding: '8px', boxSizing: 'border-box' }}
        onClick={(event) => event.stopPropagation()}
      >
        <Text style={{ fontSize: '11px' }}>媒体加载失败</Text>
        <Button
          style={{ fontSize: '11px', padding: '6px', lineHeight: '1.5' }}
          onClick={() => setRetry((n) => n + 1)}
        >
          重试
        </Button>
      </View>
    )
  if (!url)
    return (
      <View className={className} style={{ background: '#edece3', fontSize: '11px' }}>
        正在加载媒体…
      </View>
    )
  if (fileType === 'unknown')
    return (
      <View className={className} style={{ background: '#faf0d7', fontSize: '11px' }}>
        媒体信息缺失，请联系记录人核对
      </View>
    )
  if (fileType === 'video')
    return (
      <View
        className={className}
        onClick={(event) => {
          event.stopPropagation()
          void previewMedia([{ url, type: 'video' }]).catch((error) =>
            console.error('视频预览失败', error),
          )
        }}
        style={{
          background: '#edece3',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Video
          src={url}
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          objectFit='cover'
          controls={false}
          autoplay={false}
          showCenterPlayBtn={false}
          showPlayBtn={false}
          enableProgressGesture={false}
          onError={() => setFailed(true)}
        />
        <View
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              background: 'rgba(0,0,0,.4)',
              color: '#fff',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              lineHeight: '36px',
              textAlign: 'center',
            }}
          >
            ▶
          </Text>
        </View>
      </View>
    )
  return (
    <Image
      className={className}
      src={url}
      mode='aspectFill'
      onError={() => setFailed(true)}
      onClick={(event) => {
        event.stopPropagation()
        previewMedia([{ url, type: 'image' }]).catch((error) => {
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
            previewMedia(
              urls.map((item) => ({ url: item, type: 'image' })),
              index,
            ).catch((error) => {
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
