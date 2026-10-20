import { useRouter } from '@tarojs/taro'
import { View } from '@tarojs/components'
import RecordList from '../record-list'

// Compatibility route for older links; new home entries use the unified record list.
export default function CareDetail() {
  const { params } = useRouter()
  const category = params.category
  if (category !== 'feeding' && category !== 'sleep' && category !== 'diaper')
    return <View className='page'>未找到此照护类别，请返回重试。</View>
  return <RecordList fixedCategory={category} />
}
