import type { DailyRecord } from '../services/records'
import type { FeedingType } from '../types/record'
import { localDate, localTime } from './home'

export type CareCategory = 'all' | 'feeding' | 'sleep' | 'diaper' | 'health'
export type CareSubtype = 'all' | FeedingType
export const careCategories = ['feeding', 'solid_food', 'sleep', 'diaper', 'health']
export const feedingLabels: Record<FeedingType, string> = {
  breastfeeding: '母乳',
  formula: '配方奶',
  solid_food: '辅食',
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  )
}
export function validRange(start: string, end: string, today = localDate()) {
  return validDate(start) && validDate(end) && start <= end && end <= today
}
export function shiftDate(date: string, days: number) {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10)
}
export function feedingType(record: DailyRecord): FeedingType | undefined {
  if (record.category === 'solid_food') return 'solid_food'
  return record.metrics?.feedingType
}
export function filterCare(records: DailyRecord[], category: CareCategory, subtype: CareSubtype) {
  return records
    .filter(
      (record) =>
        careCategories.includes(record.category) &&
        (category === 'all' ||
          record.category === category ||
          (category === 'feeding' && record.category === 'solid_food')) &&
        (category !== 'feeding' || subtype === 'all' || feedingType(record) === subtype),
    )
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}
export function groupCare(records: DailyRecord[]) {
  const groups = new Map<string, DailyRecord[]>()
  for (const record of records) {
    const date = localDate(record.occurredAt)
    groups.set(date, [...(groups.get(date) || []), record])
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a))
}
export function careTitle(record: DailyRecord) {
  if (record.category === 'feeding' || record.category === 'solid_food')
    return feedingLabels[feedingType(record)!] || '喂养'
  const titles: Record<string, string> = { sleep: '睡眠', diaper: '排便', health: '健康' }
  return record.title || titles[record.category] || '照护记录'
}
export function careValue(record: DailyRecord) {
  const m = record.metrics || {}
  if (record.category === 'sleep') return minutesLabel(Number(m.sleepDurationMinutes) || 0)
  if (m.temperature !== undefined) return `${m.temperature} ℃`
  if (feedingType(record) === 'breastfeeding')
    return m.durationMinutes !== undefined ? `${m.durationMinutes} 分钟` : '未填写时长'
  if (m.amount !== undefined)
    return `${m.amount} ${m.unit || (feedingType(record) === 'solid_food' ? 'g' : 'ml')}`
  return record.category === 'diaper' ? '排便记录' : ''
}
export function minutesLabel(minutes: number) {
  const value = Math.round(minutes)
  return value
    ? `${Math.floor(value / 60) ? `${Math.floor(value / 60)}小时` : ''}${value % 60 ? `${value % 60}分` : ''}`
    : '0分钟'
}
export function careMetrics(records: DailyRecord[], category: CareCategory) {
  const count = (c: string) => records.filter((r) => r.category === c).length
  const sleep = records
    .filter((r) => r.category === 'sleep')
    .reduce((n, r) => n + (Number(r.metrics?.sleepDurationMinutes) || 0), 0)
  const feeds = records.filter((r) => r.category === 'feeding' || r.category === 'solid_food')
  if (category === 'feeding')
    return [
      { label: '喂养次数', value: `${feeds.length}次` },
      {
        label: '已记录配方奶量',
        value: `${feeds.filter((r) => feedingType(r) === 'formula' && (!r.metrics?.unit || r.metrics.unit === 'ml')).reduce((n, r) => n + (Number(r.metrics?.amount) || 0), 0)} ml`,
      },
      {
        label: '辅食次数',
        value: `${feeds.filter((r) => feedingType(r) === 'solid_food').length}次`,
      },
    ]
  if (category === 'sleep')
    return [
      { label: '睡眠段数', value: `${count('sleep')}段` },
      { label: '记录累计时长', value: minutesLabel(sleep) },
    ]
  if (category === 'diaper' || category === 'health')
    return [
      { label: category === 'diaper' ? '排便次数' : '健康记录', value: `${records.length}次` },
    ]
  return [
    { label: '照护记录', value: `${records.length}条` },
    { label: '喂养次数', value: `${feeds.length}次` },
    { label: '记录累计睡眠', value: minutesLabel(sleep) },
  ]
}
const metricLabels: Record<string, string> = {
  height: '身长/身高（cm）',
  headCircumference: '头围（cm）',
  measurementMethod: '身长/身高测量方法',
  measurementSource: '测量来源',
  weight: '体重（kg）',
  amount: '用量',
  unit: '单位',
  durationMinutes: '哺乳时长（分钟）',
  sleepDurationMinutes: '睡眠时长（分钟）',
  foods: '辅食内容',
  allergy: '食用反应',
  healthType: '健康类型',
  temperature: '体温（℃）',
  sleepStart: '入睡时间',
  sleepEnd: '醒来时间',
  feedingType: '喂养方式',
  side: '哺乳侧别',
  foodType: '辅食类型',
}
const valueLabels: Record<string, Record<string, string>> = {
  feedingType: feedingLabels,
  measurementMethod: { lying: '卧位身长', standing: '站立身高', unknown: '未记录方法' },
  measurementSource: { home: '家庭测量', clinic: '机构测量' },
  side: { left: '左侧', right: '右侧' },
  foodType: { staple: '主食', vegetable: '蔬菜', meat: '肉类' },
  healthType: { temperature: '体温', symptom: '症状', medicine: '用药', visit: '就医' },
}
export function detailMetrics(record: DailyRecord) {
  return Object.entries(record.metrics || {})
    .filter(
      ([key, value]) => metricLabels[key] && value !== undefined && value !== null && value !== '',
    )
    .map(([key, value]) => ({
      label: metricLabels[key],
      value:
        (key === 'sleepStart' || key === 'sleepEnd') && String(value).includes('T')
          ? `${localDate(String(value))} ${localTime(String(value))}`
          : valueLabels[key]?.[String(value)] || String(value),
    }))
}
