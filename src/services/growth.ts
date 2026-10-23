import Taro from '@tarojs/taro'
import { assertFamilyAccess } from './permissions'
import { callCloudFunction, isCloudConfigured } from './cloud'
import { useSessionStore } from '../stores/session'
import {
  createRecord,
  type CreateRecordInput,
  type DailyRecord,
  requestHomeRecordsRefresh,
} from './records'
import { growthMetrics, canManageRecord, isGrowthEvent } from '../utils/growth'
import { isMeasurement, localDate } from '../utils/home'
import type { GrowthPage, GrowthQuery, GrowthSummary } from '../types/growth'

const KEY = 'baby-growth-demo-records'
function demoRecords(): DailyRecord[] {
  const session = useSessionStore.getState(),
    media = Taro.getStorageSync('baby-growth-demo-media') || {}
  return ((Taro.getStorageSync(KEY) || []) as DailyRecord[]).map((r) => ({
    ...r,
    version: r.version || 0,
    authorName:
      r.createdBy === session.userId ? session.user?.nickname || '我' : r.authorName || '家庭成员',
    media: (r.mediaFileIds || []).map((fileId) => ({
      fileId,
      fileType: media[fileId] || 'unknown',
    })),
  }))
}
export async function listGrowthRecords(input: GrowthQuery): Promise<GrowthPage> {
  assertFamilyAccess(input.familyId, 'childId' in input ? input.childId : undefined)
  if (isCloudConfigured())
    return callCloudFunction<GrowthPage>(
      'listGrowthRecords',
      input as unknown as Record<string, unknown>,
    )
  const all = demoRecords()
    .filter(
      (r) =>
        r.familyId === input.familyId &&
        r.childId === input.childId &&
        new Date(r.occurredAt) <= new Date(),
    )
    .map((r) => ({ ...r, occurredAt: new Date(r.occurredAt).toISOString() }))
    .sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    )
  const summary: GrowthSummary = {}
  growthMetrics.forEach(
    (metric) =>
      (summary[metric] = all
        .filter((r) => isMeasurement(r) && Number(r.metrics?.[metric]) > 0)
        .slice(0, 2)),
  )
  const matched = all.filter(
    (r) =>
      (input.workspace === 'measurement'
        ? isMeasurement(r)
        : isGrowthEvent(r) &&
          (!input.eventType || input.eventType === 'all' || r.category === input.eventType)) &&
      (!input.startDate || localDate(r.occurredAt) >= input.startDate) &&
      (!input.endDate || localDate(r.occurredAt) <= input.endDate) &&
      (!input.cursor ||
        r.occurredAt < input.cursor.occurredAt ||
        (r.occurredAt === input.cursor.occurredAt && r.id < input.cursor.id)),
  )
  const limit = Math.min(input.limit || 20, 100),
    items = matched.slice(0, limit),
    last = items[items.length - 1]
  return {
    items,
    summary,
    nextCursor: matched.length > limit ? { occurredAt: last.occurredAt, id: last.id } : undefined,
  }
}
export async function loadGrowthMeasurements(input: Omit<GrowthQuery, 'workspace' | 'cursor'>) {
  let page = await listGrowthRecords({ ...input, workspace: 'measurement', limit: 100 })
  const summary = page.summary,
    items = [...page.items]
  while (page.nextCursor) {
    page = await listGrowthRecords({
      ...input,
      workspace: 'measurement',
      limit: 100,
      cursor: page.nextCursor,
    })
    items.push(...page.items)
  }
  return { items: [...new Map(items.map((r) => [r.id, r])).values()], summary }
}
function markChanged() {
  Taro.setStorageSync('baby-growth-records-updated', true)
  Taro.setStorageSync('baby-growth-growth-records-refresh', true)
  requestHomeRecordsRefresh()
}
export async function saveGrowthRecord(input: CreateRecordInput, existing?: DailyRecord) {
  assertFamilyAccess(input.familyId, 'childId' in input ? input.childId : undefined, true)
  if (!isCloudConfigured()) {
    const session = useSessionStore.getState()
    if (
      session.familyId !== input.familyId ||
      session.childId !== input.childId ||
      !['owner', 'admin', 'adult'].includes(session.currentRole || '')
    )
      throw new Error('FORBIDDEN')
  }
  if (!existing) {
    const result = await createRecord(input)
    markChanged()
    return result
  }
  const { familyId, childId } = input
  const data = {
    category: input.category,
    title: input.title,
    occurredAt: input.occurredAt,
    content: input.content || '',
    metrics: input.metrics || {},
    mediaFileIds: input.mediaFileIds || [],
  }
  if (existing.childId !== childId || existing.familyId !== familyId) throw new Error('NOT_FOUND')
  if (isCloudConfigured()) {
    const result = await callCloudFunction<{ id: string }>('updateRecord', {
      familyId,
      recordId: existing.id,
      expectedVersion: existing.version || 0,
      data,
    })
    markChanged()
    return result
  }
  const all = demoRecords(),
    record = all.find(
      (r) => r.id === existing.id && r.familyId === familyId && r.childId === childId,
    )
  const session = useSessionStore.getState()
  if (!record || !canManageRecord(session.currentRole, session.userId, record))
    throw new Error('FORBIDDEN')
  if (record.version !== (existing.version || 0)) throw new Error('RECORD_CONFLICT')
  Taro.setStorageSync(
    KEY,
    all.map((r) =>
      r.id === existing.id
        ? {
            ...r,
            ...input,
            createdBy: r.createdBy,
            version: (r.version || 0) + 1,
            updatedAt: new Date().toISOString(),
          }
        : r,
    ),
  )
  markChanged()
  return { id: existing.id }
}
export async function deleteGrowthRecord(record: DailyRecord) {
  assertFamilyAccess(record.familyId, record.childId, true)
  if (isCloudConfigured()) {
    const result = await callCloudFunction<{ mediaCleanupPending?: boolean }>('deleteRecord', {
      familyId: record.familyId,
      recordId: record.id,
      expectedVersion: record.version || 0,
    })
    markChanged()
    if (result.mediaCleanupPending) throw new Error('MEDIA_CLEANUP_PENDING')
  } else {
    const session = useSessionStore.getState(),
      all = demoRecords(),
      current = all.find(
        (r) => r.id === record.id && r.familyId === record.familyId && r.childId === record.childId,
      )
    if (!current || !canManageRecord(session.currentRole, session.userId, current))
      throw new Error('FORBIDDEN')
    if (current.version !== (record.version || 0)) throw new Error('RECORD_CONFLICT')
    const remaining = all.filter((r) => r.id !== record.id)
    const types = Taro.getStorageSync('baby-growth-demo-media') || {}
    for (const fileId of current.mediaFileIds || []) {
      if (remaining.some((r) => r.mediaFileIds?.includes(fileId))) continue
      if (types[fileId] && fileId.startsWith('wxfile://')) {
        await new Promise<void>((resolve, reject) =>
          Taro.getFileSystemManager().removeSavedFile({
            filePath: fileId,
            success: () => resolve(),
            fail: reject,
          }),
        )
      }
      delete types[fileId]
    }
    Taro.setStorageSync('baby-growth-demo-media', types)
    Taro.setStorageSync(KEY, remaining)
  }
  markChanged()
}
