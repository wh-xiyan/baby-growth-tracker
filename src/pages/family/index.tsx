import { View } from '@tarojs/components'
import { PageHeader, SectionCard } from '../../components/common'

export default function Family() {
  return (
    <View className='page'>
      <PageHeader title='家庭成员' subtitle='一起守护宝宝的成长空间' eyebrow='OUR FAMILY' />
      <SectionCard className='muted'>接入云数据后可邀请和管理家庭成员。</SectionCard>
    </View>
  )
}
