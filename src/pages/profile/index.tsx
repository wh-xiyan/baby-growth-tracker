import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Cell, CellList, PageHeader } from '../../components/common'

export default function Profile() {
  return (
    <View className='page'>
      <PageHeader title='我的' subtitle='家庭与宝宝资料' eyebrow='OUR LITTLE HOME' />
      <CellList>
        <Cell onClick={() => Taro.navigateTo({ url: '/pages/family/index' })}>家庭成员</Cell>
        <Cell onClick={() => Taro.navigateTo({ url: '/pages/child-profile/index' })}>宝宝资料</Cell>
        <Cell onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          设置与数据导出
        </Cell>
      </CellList>
    </View>
  )
}
