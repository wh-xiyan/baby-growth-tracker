import Taro from '@tarojs/taro'
import type { RecordCategory, RecordMetrics } from '../types/record'
import { callCloudFunction, isCloudConfigured } from './cloud'

const DEMO_KEY = 'baby-growth-demo-records'
const UPDATE_KEY = 'baby-growth-records-updated'
const HOME_REFRESH_KEY = 'baby-growth-home-records-refresh'

export function consumeRecordsUpdate() {
  const updated = Boolean(Taro.getStorageSync(UPDATE_KEY))
  if (updated) Taro.removeStorageSync(UPDATE_KEY)
  return updated
}

export function requestHomeRecordsRefresh() {
  Taro.setStorageSync(HOME_REFRESH_KEY, true)
}

export function consumeHomeRecordsRefresh() {
  const refresh = Boolean(Taro.getStorageSync(HOME_REFRESH_KEY))
  if (refresh) Taro.removeStorageSync(HOME_REFRESH_KEY)
  return refresh
}

export interface CreateRecordInput {
  familyId: string
  childId: string
  category: RecordCategory
  title: string
  occurredAt: string
  content?: string
  metrics?: RecordMetrics
  mediaFileIds?: string[]
}

export interface DailyRecord extends CreateRecordInput {
  id: string
}

export async function createRecord(input: CreateRecordInput): Promise<{ id: string }> {
  if (isCloudConfigured()) {
    const created = await callCloudFunction<{ id: string }>(
      'createRecord',
      input as unknown as Record<string, unknown>,
    )
    Taro.setStorageSync(UPDATE_KEY, true)
    return created
  }
  const records = (Taro.getStorageSync(DEMO_KEY) || []) as DailyRecord[]
  const id = `demo-record-${Date.now()}`
  Taro.setStorageSync(DEMO_KEY, [
    ...records,
    { ...input, id, mediaFileIds: input.mediaFileIds || [] },
  ])
  Taro.setStorageSync(UPDATE_KEY, true)
  return { id }
}

export async function listDailyRecords(input: {
  familyId: string
  childId: string
  date: string
  category?: RecordCategory
}): Promise<DailyRecord[]> {
  if (isCloudConfigured()) return callCloudFunction<DailyRecord[]>('listDailyRecords', input)
  const records = (Taro.getStorageSync(DEMO_KEY) || []) as DailyRecord[]
  return records.filter(
    (record) =>
      record.occurredAt.slice(0, 10) === input.date &&
      record.familyId === input.familyId &&
      record.childId === input.childId &&
      (!input.category || record.category === input.category),
  )
}
