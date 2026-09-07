import { Button } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

export interface PrimaryButtonProps {
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
}

export function PrimaryButton({
  children,
  onClick,
  loading = false,
  disabled = false,
}: PropsWithChildren<PrimaryButtonProps>) {
  return (
    <Button className='ui-primary-button' onClick={onClick} loading={loading} disabled={disabled}>
      {children}
    </Button>
  )
}
