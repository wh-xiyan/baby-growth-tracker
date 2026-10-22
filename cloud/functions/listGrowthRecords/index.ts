import { db, activeMember, context, result } from '../../shared/db'
import { recordAuthors } from '../../shared/record-authors'
import { selectGrowthPage } from '../../shared/growth'
import { queryRange } from '../../shared/record-range'
import { localDate } from '../../shared/home'

export async function main(event: {
  familyId?: string
  childId?: string
  workspace?: string
  eventType?: string
  startDate?: string
  endDate?: string
  cursor?: { occurredAt: string; id: string }
  limit?: number
}) {
  const familyId = String(event?.familyId || ''),
    childId = String(event?.childId || '')
  if (
    !familyId ||
    !childId ||
    !['measurement', 'events'].includes(event.workspace || '') ||
    (event.eventType && !['all', 'milestone', 'study'].includes(event.eventType)) ||
    (event.limit !== undefined && (!Number.isInteger(event.limit) || event.limit < 1)) ||
    (event.cursor &&
      (typeof event.cursor.id !== 'string' ||
        !event.cursor.id ||
        typeof event.cursor.occurredAt !== 'string' ||
        !Number.isFinite(new Date(event.cursor.occurredAt).getTime())))
  )
    throw new Error('INVALID_GROWTH_QUERY')
  await activeMember(familyId, context())
  const child = await db.collection('children').where({ _id: childId, familyId }).limit(1).get()
  if (!child.data[0]) throw new Error('CHILD_NOT_FOUND')
  if (event.startDate || event.endDate)
    queryRange({
      startDate: event.startDate || '1900-01-01',
      endDate: event.endDate || localDate(),
    })
  const records: Array<Record<string, any>> = []
  let lastId: string | undefined
  // Scan only growth categories, with a stable ID cursor. Normalize old string timestamps
  // and Date timestamps together before chronological pagination; never silently stop at 100.
  while (true) {
    const page = await db
      .collection('growth_records')
      .where({
        familyId,
        childId,
        category: db.command.in(['measurement', 'milestone', 'study']),
        deletedAt: db.command.exists(false),
        ...(lastId ? { _id: db.command.lt(lastId) } : {}),
      })
      .orderBy('_id', 'desc')
      .limit(100)
      .get()
    for (const r of page.data) {
      const date = new Date(r.occurredAt)
      if (Number.isFinite(date.getTime()) && date <= new Date())
        records.push({ ...r, id: r._id, occurredAt: date.toISOString() })
    }
    if (page.data.length < 100) break
    lastId = page.data[page.data.length - 1]._id
  }
  const selected = selectGrowthPage(records, { ...event, workspace: event.workspace! })
  const authors = await recordAuthors(familyId, selected.items)
  const ids = [...new Set(selected.items.flatMap((r) => r.mediaFileIds || []))]
  const media = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 50) {
    const assets = await db
      .collection('media_assets')
      .where({
        familyId,
        childId,
        fileId: db.command.in(ids.slice(i, i + 50)),
        deletedAt: db.command.exists(false),
      })
      .limit(100)
      .get()
    for (const asset of assets.data) media.set(asset.fileId, asset.fileType)
  }
  return result({
    ...selected,
    items: selected.items.map((r) => ({
      ...r,
      version: r.version || 0,
      authorName: authors.get(r.createdBy) || '家庭成员',
      media: (r.mediaFileIds || []).map((fileId: string) => ({
        fileId,
        fileType: media.get(fileId) || 'unknown',
      })),
    })),
  })
}
