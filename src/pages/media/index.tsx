import { View } from '@tarojs/components'
import { EmptyState, PageHeader, SectionCard } from '../../components/common'

export default function Media() {
  return (
    <View className='page'>
      <PageHeader title='相册' subtitle='收藏成长中的照片和视频' eyebrow='LITTLE MOMENTS' />
      <SectionCard>
        <EmptyState icon='♡'>还没有照片或视频</EmptyState>
      </SectionCard>
    </View>
  )
}
