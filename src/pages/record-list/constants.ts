import type { IconName } from '../../components/icon'
import type { RecordCategory } from '../../types/record'

export type Filter = 'all' | RecordCategory

export const categoryMeta: Record<
  RecordCategory,
  { label: string; icon: IconName; tone: string; background: string }
> = {
  feeding: { label: '喂养', icon: 'baby-bottle', tone: '#7FA68A', background: '#FFF0EB' },
  sleep: { label: '睡眠', icon: 'moon', tone: '#A8C3CB', background: '#E7F0F2' },
  measurement: { label: '测量', icon: 'sapling', tone: '#7FA68A', background: '#EAF1EA' },
  milestone: { label: '里程碑', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  note: { label: '备注', icon: 'camera', tone: '#879C94', background: '#EDF2EE' },
  solid_food: { label: '辅食', icon: 'baby-bottle', tone: '#7FA68A', background: '#FFF0EB' },
  diaper: { label: '排便', icon: 'baby-bottle', tone: '#7FA68A', background: '#FFF0EB' },
  health: { label: '健康', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  vaccination: { label: '疫苗', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  school: { label: '学习', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  study: { label: '学习', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  travel: { label: '出行', icon: 'camera', tone: '#879C94', background: '#EDF2EE' },
  hobby: { label: '兴趣', icon: 'camera', tone: '#879C94', background: '#EDF2EE' },
  award: { label: '成就', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
}

export const filterOptions: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'feeding', label: categoryMeta.feeding.label },
  { value: 'sleep', label: categoryMeta.sleep.label },
  { value: 'diaper', label: categoryMeta.diaper.label },
  { value: 'health', label: categoryMeta.health.label },
]
