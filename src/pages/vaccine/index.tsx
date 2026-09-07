import { View } from '@tarojs/components'
import { PageHeader, SectionCard } from '../../components/common'

export default function Vaccine() {
  return (
    <View className='page'>
      <PageHeader title='疫苗计划' subtitle='把每一次守护都记得清清楚楚' eyebrow='HEALTH & CARE' />
      <SectionCard className='muted'>接入云数据后可管理接种计划和提醒。</SectionCard>
    </View>
  )
}
