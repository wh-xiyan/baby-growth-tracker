import { Text, View } from '@tarojs/components'

export interface PageLoadingProps {
  visible?: boolean
  title?: string
  caption?: string
}

export function PageLoading({
  visible = true,
  title = '正在加载',
  caption = '请稍候',
}: PageLoadingProps) {
  if (!visible) return null

  return (
    <View className='page-loading' aria-label={title}>
      <View className='page-loading-content'>
        <View className='page-loading-mark'>
          <View className='page-loading-ring' />
          <View className='page-loading-heart'>♥</View>
        </View>
        <View className='page-loading-copy'>
          <Text className='page-loading-title'>{title}</Text>
          <Text className='page-loading-caption'>{caption}···</Text>
        </View>
      </View>
    </View>
  )
}
