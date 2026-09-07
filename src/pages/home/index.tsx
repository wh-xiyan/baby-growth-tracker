import { View } from '@tarojs/components'
import { Button } from '@nutui/nutui-react-taro'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Home() {
  const addRecord = () => Taro.navigateTo({ url: '/pages/record-edit/index' })
  return (
    <View className='page home-page'>
      <View className='page-title'>宝宝成长录</View>
      <View className='page-subtitle'>记录每一个值得记住的今天</View>
      <View className='section hero'>
        <View className='hero-name'>宝宝档案</View>
        <View className='muted'>完成家庭和宝宝设置后，这里会显示年龄与成长概览</View>
      </View>
      <View className='section'>
        <View className='section-title'>今日记录</View>
        <View className='muted'>还没有记录，先记下宝宝今天的小事吧</View>
        <Button type='primary' size='small' onClick={addRecord}>
          新增记录
        </Button>
      </View>
      <View className='section'>
        <View className='section-title'>待办提醒</View>
        <View className='muted'>暂无即将到期的疫苗提醒</View>
      </View>
    </View>
  )
}
