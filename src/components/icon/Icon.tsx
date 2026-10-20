import { Image } from '@tarojs/components'
import type { CSSProperties } from 'react'
import type { IconName, IconVariant } from './icons'
import { iconSources } from './icons'
import './index.scss'

export interface IconProps {
  name: IconName
  size?: number
  color?: string
  variant?: IconVariant
  className?: string
  ariaLabel?: string
}

export function Icon({
  name,
  size = 24,
  color,
  variant = 'default',
  className = '',
  ariaLabel,
}: IconProps) {
  const source = iconSources[name][variant] || iconSources[name].default
  const style: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    filter: color ? colorFilters[color.toUpperCase()] : undefined,
  }

  return (
    <Image
      className={`app-icon ${className}`.trim()}
      src={source}
      mode='aspectFit'
      style={style}
      aria-label={ariaLabel}
    />
  )
}

const colorFilters: Record<string, string> = {
  '#7FA68A':
    'invert(65%) sepia(15%) saturate(650%) hue-rotate(85deg) brightness(92%) contrast(86%)',
  '#459DA1':
    'invert(56%) sepia(25%) saturate(874%) hue-rotate(132deg) brightness(88%) contrast(84%)',
  '#B98A1F':
    'invert(53%) sepia(38%) saturate(1021%) hue-rotate(359deg) brightness(88%) contrast(89%)',
  '#879C94':
    'invert(65%) sepia(10%) saturate(450%) hue-rotate(100deg) brightness(90%) contrast(85%)',
  '#6B7A70':
    'invert(45%) sepia(10%) saturate(400%) hue-rotate(90deg) brightness(90%) contrast(90%)',
  '#334238': 'brightness(0) saturate(100%)',
  '#FFFFFF': 'brightness(0) invert(1)',
}
