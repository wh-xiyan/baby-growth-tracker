import { View } from '@tarojs/components'
import { EmptyState, PageHeader, SectionCard } from '../../components/common'

import { usePageDidShow } from '../../services/media-preview'
import { FamilyIdentity } from '../../components/FamilyIdentity'

export default function Media() {
  usePageDidShow(() => {})
  return (
    <View className='page'>
      <FamilyIdentity />
      <PageHeader title='相册' subtitle='收藏成长中的照片和视频' eyebrow='LITTLE MOMENTS' />
      <SectionCard>
        <EmptyState icon='♡'>还没有照片或视频</EmptyState>
      </SectionCard>
    </View>
  )
}
