import { View } from '@tarojs/components'
import { Cell, CellGroup } from '@nutui/nutui-react-taro'
import Taro from '@tarojs/taro'

export default function Profile() {
  return (
    <View className='page'>
      <View className='page-title'>我的</View>
      <View className='page-subtitle'>家庭与宝宝资料</View>
      <CellGroup>
        <Cell
          title='家庭成员'
          clickable
          onClick={() => Taro.navigateTo({ url: '/pages/family/index' })}
        />
        <Cell
          title='宝宝资料'
          clickable
          onClick={() => Taro.navigateTo({ url: '/pages/child-profile/index' })}
        />
        <Cell
          title='设置与数据导出'
          clickable
          onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}
        />
      </CellGroup>
    </View>
  )
}
