import { Input, View } from '@tarojs/components'
import { PageHeader, PrimaryButton, SectionCard } from '../../components/common'

export default function RecordEdit() {
  return (
    <View className='page'>
      <PageHeader
        title='新增记录'
        subtitle='把今天值得记住的瞬间留下来'
        eyebrow='KEEP THIS MOMENT'
      />
      <SectionCard>
        <View>
          <View>标题</View>
          <Input placeholder='例如：第一次独立走路' />
          <View>备注</View>
          <Input placeholder='补充一些细节' />
          <PrimaryButton>保存记录</PrimaryButton>
        </View>
      </SectionCard>
    </View>
  )
}
