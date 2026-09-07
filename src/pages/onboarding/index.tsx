import { View } from '@tarojs/components'
import { Button } from '@nutui/nutui-react-taro'

export default function Onboarding() {
  return (
    <View className='page'>
      <View className='page-title'>开始记录</View>
      <View className='page-subtitle'>先创建家庭和宝宝档案</View>
      <View className='section'>
        <Button type='primary'>创建家庭</Button>
      </View>
    </View>
  )
}
