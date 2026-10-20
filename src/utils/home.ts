import type { GrowthRecord } from '../types/record'

export const localDate = (value: string | Date = new Date()) => {
  const date = new Date(value)
  const shifted = new Date(date.getTime() + 8 * 3600000)
  return shifted.toISOString().slice(0, 10)
}
export const localTime = (value: string) =>
  new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(11, 16)
export const dayStart = (date: string) => new Date(`${date}T00:00:00+08:00`).getTime()
export const isMeasurement = (record: Pick<GrowthRecord, 'category' | 'metrics'>) =>
  record.category === 'measurement' ||
  (record.category === 'milestone' &&
    (record.metrics?.height !== undefined || record.metrics?.weight !== undefined))

export function measurementPoints(records: GrowthRecord[], metric: 'height' | 'weight') {
  return records
    .filter((record) => isMeasurement(record) && Number(record.metrics?.[metric]) > 0)
    .map((record) => ({
      id: record.id,
      date: localDate(record.occurredAt),
      value: Number(record.metrics?.[metric]),
      occurredAt: record.occurredAt,
    }))
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
}

export function todayCare(records: GrowthRecord[], date: string) {
  const start = dayStart(date)
  const end = start + 86400000
  const today = records.filter((record) => {
    const timestamp = new Date(record.occurredAt).getTime()
    return timestamp >= start && timestamp < end
  })
  const feeds = today.filter(
    (record) => record.category === 'feeding' && record.metrics?.feedingType !== 'solid_food',
  )
  const diapers = today.filter((record) => record.category === 'diaper')
  let sleepMinutes = 0
  for (const record of records.filter((item) => item.category === 'sleep')) {
    const metrics = record.metrics || {}
    if (
      metrics.sleepStart &&
      metrics.sleepEnd &&
      metrics.sleepStart.includes('T') &&
      metrics.sleepEnd.includes('T')
    ) {
      const from = Math.max(start, new Date(metrics.sleepStart).getTime())
      const to = Math.min(end, new Date(metrics.sleepEnd).getTime())
      sleepMinutes += Math.max(0, (to - from) / 60000)
    } else if (today.includes(record)) {
      // Old entries only stored clock times; count their duration on their recorded day.
      sleepMinutes += Number(metrics.sleepDurationMinutes) || 0
    }
  }
  const latest = (items: GrowthRecord[]) =>
    [...items].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )[0]
  return {
    feeds: feeds.length,
    diapers: diapers.length,
    sleepMinutes: Math.round(sleepMinutes),
    latestFeed: latest(feeds),
    latestDiaper: latest(diapers),
  }
}
