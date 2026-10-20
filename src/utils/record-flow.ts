import type { RecordCategory } from '../types/record'
import type { IconName } from '../components/icon'

export type RecordScene = 'care' | 'growth' | 'life'
export type RecordForm =
  | 'feeding'
  | 'sleep'
  | 'diaper'
  | 'health'
  | 'measurement'
  | 'milestone'
  | 'study'
  | 'note'
  | 'travel'
export const recordScenes: Array<{
  value: RecordScene
  label: string
  description: string
  icon: IconName
}> = [
  { value: 'care', label: '照护', description: '喂养、睡眠、排便、健康', icon: 'baby-bottle' },
  { value: 'growth', label: '成长', description: '身体测量、里程碑、学习变化', icon: 'sapling' },
  { value: 'life', label: '生活', description: '备注、旅行、照片和视频', icon: 'camera' },
]
export const recordForms: Array<{
  value: RecordForm
  scene: RecordScene
  label: string
  description: string
  icon: IconName
}> = [
  {
    value: 'feeding',
    scene: 'care',
    label: '喂养',
    description: '母乳、配方奶、辅食',
    icon: 'baby-bottle',
  },
  { value: 'sleep', scene: 'care', label: '睡眠', description: '入睡和醒来时间', icon: 'moon' },
  { value: 'diaper', scene: 'care', label: '排便', description: '排便时间和状态', icon: 'plan' },
  {
    value: 'health',
    scene: 'care',
    label: '健康',
    description: '体温、症状、用药、就医',
    icon: 'needle',
  },
  {
    value: 'measurement',
    scene: 'growth',
    label: '身体测量',
    description: '身高和体重',
    icon: 'sapling',
  },
  {
    value: 'milestone',
    scene: 'growth',
    label: '里程碑',
    description: '宝宝的每一个第一次',
    icon: 'sapling',
  },
  {
    value: 'study',
    scene: 'growth',
    label: '学习变化',
    description: '新知识与学习进步',
    icon: 'plan',
  },
  {
    value: 'note',
    scene: 'life',
    label: '备注与照片视频',
    description: '日常心情、照片、家庭视频',
    icon: 'camera',
  },
  {
    value: 'travel',
    scene: 'life',
    label: '旅行',
    description: '出游地点和旅途回忆',
    icon: 'camera',
  },
]
export function resolveRecordEntry(category?: string, scene?: string) {
  const form = category === 'solid_food' ? 'feeding' : category
  const selected = recordForms.find((item) => item.value === form)
  const selectedScene = recordScenes.find((item) => item.value === (scene || category))
  return { form: selected?.value, scene: selected?.scene || selectedScene?.value }
}
export const isCareRecord = (category: RecordCategory) =>
  ['feeding', 'solid_food', 'sleep', 'diaper', 'health'].includes(category)
