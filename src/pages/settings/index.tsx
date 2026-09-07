import { View } from '@tarojs/components'
import { PageHeader, SectionCard } from '../../components/common'

export default function Settings() {
  return (
    <View className='page'>
      <PageHeader title='设置' subtitle='把记录方式调整成你喜欢的样子' eyebrow='PREFERENCES' />
      <SectionCard className='muted'>数据导出和隐私设置将在后续版本接入。</SectionCard>
    </View>
  )
}
