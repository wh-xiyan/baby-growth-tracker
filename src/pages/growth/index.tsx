import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { EmptyState, PageHeader, PrimaryButton, SectionCard } from '../../components/common'

export default function Growth() {
  return (
    <View className='page'>
      <PageHeader title='成长' subtitle='按时间保存宝宝的成长轨迹' eyebrow='GROWING TOGETHER' />
      <SectionCard>
        <EmptyState icon='✿'>还没有成长记录</EmptyState>
        <PrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/record-edit/index' })}>
          记一笔
        </PrimaryButton>
      </SectionCard>
    </View>
  )
}
