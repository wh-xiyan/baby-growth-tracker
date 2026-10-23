import { isMeasurement, localDate } from './home'

export const growthMetrics = ['height', 'weight', 'headCircumference'] as const
export function isGrowthCategory(category: string) {
  return ['measurement', 'milestone', 'study'].includes(category)
}
export function validateGrowthDate(
  record: { category: string; occurredAt: Date },
  birthday: unknown,
) {
  if (!isGrowthCategory(record.category)) return
  if (!(birthday instanceof Date) && typeof birthday !== 'string')
    throw new Error('INVALID_GROWTH_DATE')
  if (!Number.isFinite(new Date(birthday).getTime())) throw new Error('INVALID_GROWTH_DATE')
  const birth =
    typeof birthday === 'string' && /^\d{4}-\d{2}-\d{2}/.test(birthday)
      ? new Date(birthday.slice(0, 10) + 'T00:00:00+08:00')
      : new Date(localDate(birthday as Date) + 'T00:00:00+08:00')
  if (
    !Number.isFinite(birth.getTime()) ||
    record.occurredAt < birth ||
    record.occurredAt > new Date()
  )
    throw new Error('INVALID_GROWTH_DATE')
}
export function assertRecordManager(
  member: { role: string; userId: string },
  record: { createdBy?: string },
) {
  if (
    member.role !== 'owner' &&
    member.role !== 'admin' &&
    !(member.role === 'adult' && record.createdBy === member.userId)
  )
    throw new Error('FORBIDDEN')
}
export function assertVersion(existing: { version?: number }, expectedVersion: unknown) {
  if (!Number.isInteger(expectedVersion) || expectedVersion !== (existing.version || 0))
    throw new Error('RECORD_CONFLICT')
}
export function selectGrowthPage(
  records: Array<Record<string, any>>,
  event: {
    workspace: string
    eventType?: string
    startDate?: string
    endDate?: string
    cursor?: { occurredAt: string; id: string }
    limit?: number
  },
) {
  const sorted = records
    .slice()
    .sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    )
  const summary = Object.fromEntries(
    growthMetrics.map((metric) => [
      metric,
      sorted.filter((r) => isMeasurement(r as any) && Number(r.metrics?.[metric]) > 0).slice(0, 2),
    ]),
  )
  const filtered = sorted.filter((r) => {
    const measurement = isMeasurement(r as any),
      date = localDate(r.occurredAt)
    return (
      (event.workspace === 'measurement'
        ? measurement
        : !measurement &&
          ['milestone', 'study'].includes(r.category) &&
          (!event.eventType || event.eventType === 'all' || r.category === event.eventType)) &&
      (!event.startDate || date >= event.startDate) &&
      (!event.endDate || date <= event.endDate) &&
      (!event.cursor ||
        r.occurredAt < event.cursor.occurredAt ||
        (r.occurredAt === event.cursor.occurredAt && r.id < event.cursor.id))
    )
  })
  const limit = Math.min(Math.max(Math.floor(event.limit || 20), 1), 100)
  const items = filtered.slice(0, limit),
    last = items[items.length - 1]
  return {
    items,
    summary: event.workspace === 'measurement' ? summary : {},
    nextCursor: filtered.length > limit ? { occurredAt: last.occurredAt, id: last.id } : undefined,
  }
}
