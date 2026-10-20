import { db } from './db'
export async function recordAuthors(familyId: string, records: Array<{ createdBy?: string }>) {
  const ids = [
    ...new Set(records.map((r) => r.createdBy).filter((id): id is string => Boolean(id))),
  ]
  const names = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 50) {
    const rows = await db
      .collection('family_members')
      .where({ familyId, userId: db.command.in(ids.slice(i, i + 50)) })
      .limit(100)
      .get()
    for (const row of rows.data) names.set(row.userId, row.displayName || '家庭成员')
  }
  return names
}
