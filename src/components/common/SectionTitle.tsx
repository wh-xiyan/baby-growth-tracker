import { Text, View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

export interface SectionTitleProps {
  action?: string
}

export function SectionTitle({ children, action }: PropsWithChildren<SectionTitleProps>) {
  return (
    <View className='ui-section-heading'>
      <View className='ui-section-title'>{children}</View>
      {action && <Text className='ui-section-action'>{action}</Text>}
    </View>
  )
}
