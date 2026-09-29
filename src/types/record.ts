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

export type FeedingType = 'breastfeeding' | 'formula' | 'solid_food'

export interface RecordMetrics {
  feedingType?: FeedingType
  side?: 'left' | 'right'
  durationMinutes?: number
  amount?: number
  unit?: 'ml' | 'g'
  foodType?: 'staple' | 'vegetable' | 'meat'
  foods?: string
  allergy?: string
  sleepStart?: string
  sleepEnd?: string
  sleepDurationMinutes?: number
  height?: number
  weight?: number
  [key: string]: string | number | undefined
}

export interface GrowthRecord {
  id: string
  familyId: string
  childId: string
  category: RecordCategory
  title: string
  occurredAt: string
  content?: string
  metrics?: RecordMetrics
  mediaFileIds: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}
