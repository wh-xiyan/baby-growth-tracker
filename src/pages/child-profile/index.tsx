import { View } from '@tarojs/components'
import { PageHeader, SectionCard } from '../../components/common'

export default function ChildProfile() {
  return (
    <View className='page'>
      <PageHeader title='宝宝资料' subtitle='记录宝宝独一无二的成长轨迹' eyebrow='BABY PROFILE' />
      <SectionCard className='muted'>接入云数据后可编辑宝宝档案。</SectionCard>
    </View>
  )
}
