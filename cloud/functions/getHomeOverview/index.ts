import { db, context, activeMember, result } from '../../shared/db'
import { localDate, dayStart, isMeasurement } from '../../shared/home'
import type { GrowthRecord } from '../../shared/home'

export async function main(event: { familyId?: string; childId?: string; date?: string }) {
  const familyId = String(event?.familyId || '')
  const childId = String(event?.childId || '')
  const date = event.date || localDate()
  if (!familyId || !childId || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error('INVALID_HOME_QUERY')
  await activeMember(familyId, context())
  const child = await db.collection('children').where({ _id: childId, familyId }).limit(1).get()
  if (!child.data[0]) throw new Error('CHILD_NOT_FOUND')
  const records: GrowthRecord[] = []
  let skip = 0
  // Explicit pagination avoids silently truncating daily totals or historical measurements.
  while (true) {
    const page = await db
      .collection('growth_records')
      .where({ familyId, childId, deletedAt: db.command.exists(false) })
      .orderBy('occurredAt', 'desc')
      .skip(skip)
      .limit(100)
      .get()
    for (const item of page.data)
      records.push({ ...item, id: item._id, occurredAt: new Date(item.occurredAt).toISOString() })
    if (page.data.length < 100) break
    skip += page.data.length
  }
  const sorted = records.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )
  const milestone = sorted.find((item) => item.category === 'milestone' && !isMeasurement(item))
  let authorName = '家庭成员'
  if (milestone) {
    const author = await db
      .collection('family_members')
      .where({ familyId, userId: milestone.createdBy })
      .limit(1)
      .get()
    authorName = author.data[0]?.displayName || authorName
  }
  const media = milestone?.mediaFileIds?.length
    ? await db
        .collection('media_assets')
        .where({
          familyId,
          childId,
          fileId: db.command.in(milestone.mediaFileIds),
          deletedAt: db.command.exists(false),
        })
        .get()
    : { data: [] }
  return result({
    careRecords: sorted.filter(
      (item) =>
        new Date(item.occurredAt).getTime() >= dayStart(date) - 86400000 &&
        new Date(item.occurredAt).getTime() < dayStart(date) + 86400000,
    ),
    measurements: sorted.filter(isMeasurement).slice(0, 100),
    milestone: milestone
      ? {
          ...milestone,
          authorName,
          media: media.data.map((item: Record<string, any>) => ({
            fileId: item.fileId,
            fileType: item.fileType,
          })),
        }
      : undefined,
  })
}
