import { View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

export interface SectionCardProps {
  className?: string
}

export function SectionCard({ children, className = '' }: PropsWithChildren<SectionCardProps>) {
  return <View className={'ui-card ' + className}>{children}</View>
}
