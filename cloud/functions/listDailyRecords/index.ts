import { db, context, activeMember, result } from '../../shared/db'

export async function main(event: {
  familyId?: string
  childId?: string
  date?: string
  category?: string
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const childId = String(event?.childId || '')
  const date = String(event?.date || '')
  if (!familyId || !childId || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error('INVALID_DAILY_RECORD_QUERY')
  await activeMember(familyId, openid)
  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 86400000)
  const baseWhere: Record<string, unknown> = {
    familyId,
    childId,
    deletedAt: db.command.exists(false),
  }
  if (event.category) baseWhere.category = event.category

  // Older records were written with an ISO string while the schema describes
  // occurredAt as a Date. Query both representations during the migration.
  const stringStart = `${date}T00:00:00.000Z`
  const stringEnd = `${date}T23:59:59.999Z`
  const [dateRecords, stringRecords] = await Promise.all([
    db
      .collection('growth_records')
      .where({ ...baseWhere, occurredAt: db.command.gte(start).and(db.command.lt(end)) })
      .orderBy('occurredAt', 'asc')
      .get(),
    db
      .collection('growth_records')
      .where({
        ...baseWhere,
        occurredAt: db.command.gte(stringStart).and(db.command.lte(stringEnd)),
      })
      .orderBy('occurredAt', 'asc')
      .get(),
  ])
  const uniqueRecords = new Map<string, Record<string, any>>()
  for (const item of [...dateRecords.data, ...stringRecords.data]) {
    uniqueRecords.set(item._id, item)
  }
  const records = [...uniqueRecords.values()].sort((left, right) =>
    String(left.occurredAt).localeCompare(String(right.occurredAt)),
  )
  return result(records.map((item) => ({ ...item, id: item._id })))
}
