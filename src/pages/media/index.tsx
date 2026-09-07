import { View } from '@tarojs/components'
import { Empty } from '@nutui/nutui-react-taro'

export default function Media() {
  return (
    <View className='page'>
      <View className='page-title'>相册</View>
      <View className='page-subtitle'>收藏成长中的照片和视频</View>
      <View className='section'>
        <Empty description='还没有照片或视频' />
      </View>
    </View>
  )
}
