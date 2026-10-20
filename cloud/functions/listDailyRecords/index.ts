import { db, context, activeMember, result } from '../../shared/db'
import { recordAuthors } from '../../shared/record-authors'
import { queryRange } from '../../shared/record-range'

export async function main(event: {
  familyId?: string
  childId?: string
  date?: string
  startDate?: string
  endDate?: string
  category?: string
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const childId = String(event?.childId || '')
  if (!familyId || !childId) throw new Error('INVALID_DAILY_RECORD_QUERY')
  await activeMember(familyId, openid)
  const { start, end } = queryRange(event)
  const baseWhere: Record<string, unknown> = {
    familyId,
    childId,
    deletedAt: db.command.exists(false),
  }
  if (event.category)
    baseWhere.category =
      event.category === 'feeding' ? db.command.in(['feeding', 'solid_food']) : event.category

  // Older records were written with an ISO string while the schema describes
  // occurredAt as a Date. Query both representations during the migration.
  const stringStart = start.toISOString()
  const stringEnd = new Date(end.getTime() - 1).toISOString()
  const queryAll = async (occurredAt: unknown) => {
    const rows: Record<string, any>[] = []
    while (true) {
      const page = await db
        .collection('growth_records')
        .where({ ...baseWhere, occurredAt })
        .orderBy('occurredAt', 'asc')
        .skip(rows.length)
        .limit(100)
        .get()
      rows.push(...page.data)
      if (page.data.length < 100) return rows
    }
  }
  const [dateRecords, stringRecords] = await Promise.all([
    queryAll(db.command.gte(start).and(db.command.lt(end))),
    queryAll(db.command.gte(stringStart).and(db.command.lte(stringEnd))),
  ])
  const uniqueRecords = new Map<string, Record<string, any>>()
  for (const item of [...dateRecords, ...stringRecords]) {
    uniqueRecords.set(item._id, item)
  }
  const records = [...uniqueRecords.values()].sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  )
  const authors = await recordAuthors(familyId, records)
  return result(
    records.map((item) => ({
      ...item,
      id: item._id,
      authorName: authors.get(item.createdBy) || '家庭成员',
      occurredAt: new Date(item.occurredAt).toISOString(),
    })),
  )
}
