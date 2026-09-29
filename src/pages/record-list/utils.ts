import type { DailyRecord } from '../../services/records'

export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

export const parseDateKey = (value: string) => new Date(`${value}T12:00:00`)

export const dateLabel = (date: Date) =>
  `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · 星期${
    '日一二三四五六'[date.getDay()]
  }`

export const timeOf = (record: DailyRecord) => record.occurredAt.slice(11, 16) || '--:--'

export const durationLabel = (minutes = 0) => {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (!hours) return `${remainder} 分钟`
  if (!remainder) return `${hours} 小时`
  return `${hours} 小时 ${remainder} 分钟`
}
