import babyBottle from '../../assets/icons/baby-bottle.svg'
import moon from '../../assets/icons/moon.svg'
import sapling from '../../assets/icons/sapling.svg'
import camera from '../../assets/icons/camera.svg'
import down from '../../assets/icons/down.svg'
import config from '../../assets/icons/config.svg'
import uploadOne from '../../assets/icons/upload-one.svg'

export type IconName =
  | 'baby-bottle'
  | 'moon'
  | 'sapling'
  | 'camera'
  | 'down'
  | 'config'
  | 'upload-one'

export type IconVariant = 'default' | 'active' | 'muted'
type IconSource = Partial<Record<IconVariant, string>> & { default: string }

export const iconSources: Record<IconName, IconSource> = {
  'baby-bottle': { default: babyBottle },
  moon: { default: moon },
  sapling: { default: sapling },
  camera: { default: camera },
  down: { default: down },
  config: { default: config },
  'upload-one': { default: uploadOne },
}
