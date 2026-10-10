import { db, context, activeMember, result } from '../../shared/db'

type Urgency = 'overdue' | 'today' | 'upcoming'

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((item) => [item.type, item.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00+08:00`)
}

export async function main(event: { familyId?: string; childId?: string; limit?: number }) {
  const familyId = String(event?.familyId || '')
  const childId = String(event?.childId || '')
  if (!familyId || !childId) throw new Error('INVALID_REMINDER_QUERY')
  await activeMember(familyId, context())
  const todayKey = dateKey(new Date())
  const today = startOfDay(todayKey)
  const end = new Date(today.getTime() + 8 * 86400000)
  const limit = Math.min(Math.max(Number(event.limit) || 3, 1), 10)
  const vaccines = await db
    .collection('vaccines')
    .where({
      familyId,
      childId,
      status: 'planned',
      plannedDate: db.command.lt(end),
    })
    .orderBy('plannedDate', 'asc')
    .get()
  const reminders = vaccines.data
    .map((item: Record<string, any>) => {
      const plannedKey = dateKey(new Date(item.plannedDate))
      const distance = Math.round((startOfDay(plannedKey).getTime() - today.getTime()) / 86400000)
      const urgency: Urgency = distance < 0 ? 'overdue' : distance === 0 ? 'today' : 'upcoming'
      return {
        id: item._id,
        type: 'vaccination' as const,
        vaccineName: item.name,
        doseNumber: item.doseNumber,
        plannedDate: plannedKey,
        urgency,
        relativeLabel:
          distance < 0
            ? `已逾期 ${Math.abs(distance)} 天`
            : distance === 0
              ? '今天接种'
              : `还有 ${distance} 天`,
      }
    })
    .sort(
      (
        left: { urgency: Urgency; plannedDate: string },
        right: { urgency: Urgency; plannedDate: string },
      ) => {
        const order: Record<Urgency, number> = { overdue: 0, today: 1, upcoming: 2 }
        return (
          order[left.urgency] - order[right.urgency] ||
          left.plannedDate.localeCompare(right.plannedDate)
        )
      },
    )
    .slice(0, limit)
  return result(reminders)
}
