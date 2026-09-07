import { Text, View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

export interface CellProps {
  onClick?: () => void
  detail?: boolean
}

export function Cell({ children, onClick, detail = true }: PropsWithChildren<CellProps>) {
  return (
    <View className={'ui-cell ' + (onClick ? 'ui-cell-action' : '')} onClick={onClick}>
      <View>{children}</View>
      {detail && <Text className='ui-cell-chevron'>›</Text>}
    </View>
  )
}
