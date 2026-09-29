import type { IconName } from '../../components/icon'
import type { RecordCategory } from '../../types/record'

export type Filter = 'all' | RecordCategory

export const categoryMeta: Record<
  RecordCategory,
  { label: string; icon: IconName; tone: string; background: string }
> = {
  feeding: { label: '喂养', icon: 'baby-bottle', tone: '#E79576', background: '#FFF0EB' },
  sleep: { label: '睡眠', icon: 'moon', tone: '#8EA6C6', background: '#EEF5FB' },
  milestone: { label: '成长', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  note: { label: '瞬间', icon: 'camera', tone: '#C98CA1', background: '#F9EDF2' },
  solid_food: { label: '辅食', icon: 'baby-bottle', tone: '#E79576', background: '#FFF0EB' },
  diaper: { label: '护理', icon: 'baby-bottle', tone: '#E79576', background: '#FFF0EB' },
  health: { label: '健康', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  vaccination: { label: '疫苗', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  school: { label: '学习', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  study: { label: '学习', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
  travel: { label: '出行', icon: 'camera', tone: '#C98CA1', background: '#F9EDF2' },
  hobby: { label: '兴趣', icon: 'camera', tone: '#C98CA1', background: '#F9EDF2' },
  award: { label: '成就', icon: 'sapling', tone: '#82A987', background: '#EEF7ED' },
}

export const filterOptions: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'feeding', label: categoryMeta.feeding.label },
  { value: 'solid_food', label: categoryMeta.solid_food.label },
  { value: 'sleep', label: categoryMeta.sleep.label },
  { value: 'milestone', label: categoryMeta.milestone.label },
  { value: 'health', label: categoryMeta.health.label },
  { value: 'vaccination', label: categoryMeta.vaccination.label },
  { value: 'school', label: categoryMeta.school.label },
  { value: 'study', label: categoryMeta.study.label },
  { value: 'travel', label: categoryMeta.travel.label },
  { value: 'hobby', label: categoryMeta.hobby.label },
  { value: 'award', label: categoryMeta.award.label },
  { value: 'note', label: categoryMeta.note.label },
]
