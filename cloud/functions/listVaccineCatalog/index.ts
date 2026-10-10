import { context, db, result } from '../../shared/db'

export async function main(event: { keyword?: string; limit?: number }) {
  context()
  const keyword = String(event?.keyword || '').trim()
  const limit = Math.min(Math.max(Number(event?.limit) || 50, 1), 100)
  const catalog = await db
    .collection('vaccine_catalog')
    .where({ active: true })
    .orderBy('sortOrder', 'asc')
    .get()
  const normalizedKeyword = keyword.toLowerCase()
  const items = catalog.data
    .filter((item: Record<string, any>) => {
      if (!normalizedKeyword) return true
      return [item.name, ...(item.aliases || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword))
    })
    .slice(0, limit)
    .map((item: Record<string, any>) => ({
      id: item._id,
      name: item.name,
      category: item.category,
      aliases: item.aliases || [],
      description: item.description || '',
      active: item.active,
      sortOrder: item.sortOrder,
      defaultDoses: item.defaultDoses,
      minDoses: item.minDoses,
      maxDoses: item.maxDoses,
      doseIntervals: item.doseIntervals || [],
    }))
  return result(items)
}
