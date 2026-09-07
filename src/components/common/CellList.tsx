import { View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

export function CellList({ children }: PropsWithChildren) {
  return <View className='ui-cell-list'>{children}</View>
}
