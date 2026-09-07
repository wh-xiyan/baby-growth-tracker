export type RecordCategory =
  | 'feeding'
  | 'solid_food'
  | 'sleep'
  | 'diaper'
  | 'health'
  | 'vaccination'
  | 'milestone'
  | 'school'
  | 'study'
  | 'travel'
  | 'hobby'
  | 'award'
  | 'note'

export interface GrowthRecord {
  id: string
  familyId: string
  childId: string
  category: RecordCategory
  title: string
  occurredAt: string
  content?: string
  mediaFileIds: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}
