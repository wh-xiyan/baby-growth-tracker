import type { DailyRecord } from '../services/records'

export type GrowthMetric = 'height' | 'weight' | 'headCircumference'
export type GrowthWorkspace = 'measurement' | 'events'
export type GrowthEventType = 'all' | 'milestone' | 'study'
export interface GrowthCursor {
  occurredAt: string
  id: string
}
export interface GrowthQuery {
  familyId: string
  childId: string
  workspace: GrowthWorkspace
  eventType?: GrowthEventType
  startDate?: string
  endDate?: string
  cursor?: GrowthCursor
  limit?: number
}
export type GrowthSummary = Partial<Record<GrowthMetric, DailyRecord[]>>
export interface GrowthPage {
  items: DailyRecord[]
  nextCursor?: GrowthCursor
  summary: GrowthSummary
}
export interface GrowthPoint {
  id: string
  date: string
  value: number
  age: number
  method?: string
}
export type StandardRow = [number, number, number, number, number, number, number, number]
export interface GrowthReference {
  reason?: string
  position?: string
  row?: StandardRow
  month?: number
  table?: string
}
