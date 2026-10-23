import Taro from '@tarojs/taro'
import { assertFamilyAccess } from './permissions'
import { localDate } from '../utils/home'
import { validRange } from '../utils/care-records'
import { useSessionStore } from '../stores/session'
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
  createdBy?: string
  version?: number
  updatedAt?: string
  authorName?: string
  media?: Array<{ fileId: string; fileType: string }>
}

export async function createRecord(input: CreateRecordInput): Promise<{ id: string }> {
  assertFamilyAccess(input.familyId, 'childId' in input ? input.childId : undefined, true)
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
    {
      ...input,
      id,
      version: 1,
      updatedAt: new Date().toISOString(),
      createdBy: useSessionStore.getState().userId,
      mediaFileIds: input.mediaFileIds || [],
    },
  ])
  Taro.setStorageSync(UPDATE_KEY, true)
  return { id }
}

export async function listDailyRecords(input: {
  familyId: string
  childId: string
  date?: string
  startDate?: string
  endDate?: string
  category?: RecordCategory
}): Promise<DailyRecord[]> {
  assertFamilyAccess(input.familyId, 'childId' in input ? input.childId : undefined)
  const startDate = input.startDate || input.date || localDate()
  const endDate = input.endDate || input.date || startDate
  if (!validRange(startDate, endDate)) throw new Error('INVALID_DAILY_RECORD_QUERY')
  if (isCloudConfigured())
    return callCloudFunction<DailyRecord[]>('listDailyRecords', { ...input, startDate, endDate })
  const session = useSessionStore.getState()
  const records = (Taro.getStorageSync(DEMO_KEY) || []) as DailyRecord[]
  return records
    .filter(
      (record) =>
        localDate(record.occurredAt) >= startDate &&
        localDate(record.occurredAt) <= endDate &&
        record.familyId === input.familyId &&
        record.childId === input.childId &&
        (!input.category ||
          record.category === input.category ||
          (input.category === 'feeding' && record.category === 'solid_food')),
    )
    .map((record) => ({
      ...record,
      authorName:
        record.createdBy === session.userId
          ? session.user?.nickname || '我'
          : record.authorName || '家庭成员',
    }))
}

export async function listRecords(input: {
  familyId: string
  childId: string
  category?: RecordCategory
  limit?: number
  skip?: number
}): Promise<DailyRecord[]> {
  assertFamilyAccess(input.familyId, 'childId' in input ? input.childId : undefined)
  if (isCloudConfigured()) return callCloudFunction<DailyRecord[]>('listRecords', input)
  return ((Taro.getStorageSync(DEMO_KEY) || []) as DailyRecord[])
    .filter(
      (record) =>
        record.familyId === input.familyId &&
        record.childId === input.childId &&
        (!input.category || record.category === input.category),
    )
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(input.skip || 0, (input.skip || 0) + (input.limit || 20))
}

export async function getRecord(input: {
  familyId: string
  childId: string
  recordId: string
}): Promise<DailyRecord> {
  assertFamilyAccess(input.familyId, 'childId' in input ? input.childId : undefined)
  if (isCloudConfigured()) return callCloudFunction<DailyRecord>('getRecord', input)
  const record = ((Taro.getStorageSync(DEMO_KEY) || []) as DailyRecord[]).find(
    (item) =>
      item.id === input.recordId &&
      item.familyId === input.familyId &&
      item.childId === input.childId,
  )
  if (!record) throw new Error('NOT_FOUND')
  const session = useSessionStore.getState()
  return {
    ...record,
    version: record.version || 0,
    authorName:
      record.createdBy === session.userId
        ? session.user?.nickname || '我'
        : record.authorName || '家庭成员',
    media: (record.mediaFileIds || []).map((fileId) => ({
      fileId,
      fileType:
        (Taro.getStorageSync('baby-growth-demo-media') || {})[fileId] ||
        (['measurement', 'milestone', 'study'].includes(record.category) ? 'unknown' : 'image'),
    })),
  }
}
