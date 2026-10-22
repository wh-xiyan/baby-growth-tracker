export interface GrowthRecord {
  id: string
  category: string
  occurredAt: string
  content?: string
  createdBy?: string
  metrics?: Record<string, any>
  [key: string]: any
}
export const localDate = (value: string | Date = new Date()) =>
  new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10)
export const dayStart = (date: string) => new Date(`${date}T00:00:00+08:00`).getTime()
export const isMeasurement = (record: Pick<GrowthRecord, 'category' | 'metrics'>) =>
  record.category === 'measurement' ||
  (record.category === 'milestone' &&
    (record.metrics?.height !== undefined ||
      record.metrics?.weight !== undefined ||
      record.metrics?.headCircumference !== undefined))
