import { db } from './db'
const categories = new Set([
  'feeding',
  'solid_food',
  'sleep',
  'diaper',
  'health',
  'vaccination',
  'measurement',
  'milestone',
  'school',
  'study',
  'travel',
  'hobby',
  'award',
  'note',
])
export function validateRecord(data: Record<string, any>) {
  if (
    !categories.has(data.category) ||
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.length > 200 ||
    (typeof data.occurredAt !== 'string' && !(data.occurredAt instanceof Date)) ||
    !Number.isFinite(new Date(data.occurredAt).getTime())
  )
    throw new Error('INVALID_RECORD')
  if (
    data.content !== undefined &&
    (typeof data.content !== 'string' || data.content.length > 10000)
  )
    throw new Error('INVALID_CONTENT')
  const metrics = data.metrics || {}
  if (typeof metrics !== 'object' || Array.isArray(metrics)) throw new Error('INVALID_METRICS')
  for (const key of [
    'height',
    'weight',
    'amount',
    'durationMinutes',
    'sleepDurationMinutes',
    'temperature',
  ]) {
    if (
      metrics[key] !== undefined &&
      (typeof metrics[key] !== 'number' || !Number.isFinite(metrics[key]) || metrics[key] < 0)
    )
      throw new Error('INVALID_METRICS')
  }
  if (data.category === 'measurement' && !(metrics.height > 0 || metrics.weight > 0))
    throw new Error('MEASUREMENT_REQUIRED')
  if (
    metrics.sleepStart?.includes('T') &&
    metrics.sleepEnd?.includes('T') &&
    !(new Date(metrics.sleepEnd).getTime() > new Date(metrics.sleepStart).getTime())
  )
    throw new Error('INVALID_SLEEP_INTERVAL')
  if (
    data.mediaFileIds !== undefined &&
    (!Array.isArray(data.mediaFileIds) ||
      data.mediaFileIds.length > 9 ||
      data.mediaFileIds.some((id: unknown) => typeof id !== 'string'))
  )
    throw new Error('INVALID_MEDIA')
  return {
    category: data.category,
    title: data.title.trim(),
    occurredAt: new Date(data.occurredAt),
    content: data.content || '',
    metrics,
    mediaFileIds: data.mediaFileIds || [],
  }
}
export async function validateRecordMedia(familyId: string, childId: string, ids: string[]) {
  if (!ids.length) return
  const media = await db
    .collection('media_assets')
    .where({ familyId, childId, fileId: db.command.in(ids), deletedAt: db.command.exists(false) })
    .get()
  if (
    new Set(media.data.map((item: Record<string, any>) => item.fileId)).size !== new Set(ids).size
  )
    throw new Error('INVALID_MEDIA_OWNERSHIP')
}
export async function ownedDocument(collection: string, id: string, familyId: string) {
  const found = await db.collection(collection).doc(id).get()
  if (!found.data || found.data.familyId !== familyId || found.data.deletedAt)
    throw new Error('NOT_FOUND')
  return found.data
}
