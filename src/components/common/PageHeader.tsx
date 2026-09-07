import { View } from '@tarojs/components'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
}

export function PageHeader({ title, subtitle, eyebrow }: PageHeaderProps) {
  return (
    <View className='ui-page-header'>
      {eyebrow && <View className='ui-eyebrow'>{eyebrow}</View>}
      <View className='ui-page-title'>{title}</View>
      {subtitle && <View className='ui-page-subtitle'>{subtitle}</View>}
    </View>
  )
}
