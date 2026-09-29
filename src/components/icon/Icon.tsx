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
  '#E79576':
    'invert(67%) sepia(36%) saturate(665%) hue-rotate(321deg) brightness(101%) contrast(89%)',
  '#459DA1':
    'invert(56%) sepia(25%) saturate(874%) hue-rotate(132deg) brightness(88%) contrast(84%)',
  '#BD8526':
    'invert(53%) sepia(38%) saturate(1021%) hue-rotate(359deg) brightness(88%) contrast(89%)',
  '#8B71BD':
    'invert(50%) sepia(19%) saturate(1121%) hue-rotate(220deg) brightness(87%) contrast(86%)',
  '#A49B95':
    'invert(70%) sepia(8%) saturate(347%) hue-rotate(337deg) brightness(89%) contrast(86%)',
  '#403B39': 'brightness(0) saturate(100%)',
  '#FFFFFF': 'brightness(0) invert(1)',
}
