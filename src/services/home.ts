import Taro from '@tarojs/taro'
import type { GrowthRecord } from '../types/record'
import { callCloudFunction, isCloudConfigured } from './cloud'
import { dayStart, isMeasurement } from '../utils/home'
import { useSessionStore } from '../stores/session'

export interface HomeOverview {
  careRecords: GrowthRecord[]
  measurements: GrowthRecord[]
  milestone?: GrowthRecord & {
    authorName: string
    media?: Array<{ fileId: string; fileType: string }>
  }
}
export async function getHomeOverview(input: {
  familyId: string
  childId: string
  date: string
}): Promise<HomeOverview> {
  if (isCloudConfigured()) return callCloudFunction<HomeOverview>('getHomeOverview', input)
  const records = ((Taro.getStorageSync('baby-growth-demo-records') || []) as GrowthRecord[])
    .filter((item) => item.familyId === input.familyId && item.childId === input.childId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  const milestone = records.find((item) => item.category === 'milestone' && !isMeasurement(item))
  return {
    careRecords: records.filter(
      (item) =>
        new Date(item.occurredAt).getTime() >= dayStart(input.date) - 86400000 &&
        new Date(item.occurredAt).getTime() < dayStart(input.date) + 86400000,
    ),
    measurements: records.filter(isMeasurement).slice(0, 100),
    milestone: milestone
      ? {
          ...milestone,
          authorName: useSessionStore.getState().user?.nickname || '我',
          media: (milestone.mediaFileIds || []).map((fileId) => ({
            fileId,
            fileType: (Taro.getStorageSync('baby-growth-demo-media') || {})[fileId] || 'image',
          })),
        }
      : undefined,
  }
}
