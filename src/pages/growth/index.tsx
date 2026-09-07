import { View } from '@tarojs/components'
import { Button, Empty } from '@nutui/nutui-react-taro'
import Taro from '@tarojs/taro'

export default function Growth() {
  return (
    <View className='page'>
      <View className='page-title'>成长</View>
      <View className='page-subtitle'>按时间保存宝宝的成长轨迹</View>
      <View className='section'>
        <Empty description='还没有成长记录' />
        <Button type='primary' onClick={() => Taro.navigateTo({ url: '/pages/record-edit/index' })}>
          记一笔
        </Button>
      </View>
    </View>
  )
}
