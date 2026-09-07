import { View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

export interface EmptyStateProps {
  icon?: string
}

export function EmptyState({ children, icon = '✦' }: PropsWithChildren<EmptyStateProps>) {
  return (
    <View className='ui-empty'>
      <View className='ui-empty-icon'>{icon}</View>
      <View className='ui-empty-text'>{children}</View>
    </View>
  )
}
