import { activeMember, context, db, now, result } from '../../shared/db'

const text = (value: unknown, maxLength: number) => {
  const content = String(value || '').trim()
  if (content.length > maxLength) throw new Error('TEXT_TOO_LONG')
  return content
}

export async function main(event: {
  familyId?: string
  vaccineId?: string
  data?: Record<string, unknown>
}) {
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, context(), true)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!event.vaccineId || !event.data) throw new Error('INVALID_VACCINE')

  const vaccine = await db.collection('vaccines').doc(event.vaccineId).get()
  if (!vaccine.data || vaccine.data.familyId !== familyId) throw new Error('VACCINE_NOT_FOUND')
  if (!['owner', 'admin'].includes(member.role) && vaccine.data.createdBy !== member.userId)
    throw new Error('FORBIDDEN')
  if (vaccine.data.status === 'completed') throw new Error('COMPLETED_VACCINE_IMMUTABLE')

  const data = event.data
  if (data.catalogId !== undefined || data.doseNumber !== undefined || data.name !== undefined) {
    throw new Error('VACCINE_SERIES_FIELD_IMMUTABLE')
  }

  const update: Record<string, unknown> = {}
  if (data.plannedDate) {
    const plannedDate = new Date(String(data.plannedDate))
    if (Number.isNaN(plannedDate.getTime())) throw new Error('INVALID_PLANNED_DATE')
    if (vaccine.data.catalogId && vaccine.data.doseNumber) {
      const siblings = await db
        .collection('vaccines')
        .where({
          familyId,
          childId: vaccine.data.childId,
          catalogId: vaccine.data.catalogId,
        })
        .get()
      const doseNumber = Number(vaccine.data.doseNumber)
      const previous = siblings.data.find(
        (item: Record<string, any>) => Number(item.doseNumber) === doseNumber - 1,
      )
      const next = siblings.data.find(
        (item: Record<string, any>) => Number(item.doseNumber) === doseNumber + 1,
      )
      const catalog = await db
        .collection('vaccine_catalog')
        .doc(String(vaccine.data.catalogId))
        .get()
      if (
        previous &&
        plannedDate.getTime() - new Date(previous.completedDate || previous.plannedDate).getTime() <
          Number((catalog.data?.doseIntervals || [])[doseNumber - 1] || 0) * 86400000
      ) {
        throw new Error('VACCINE_INTERVAL_INVALID')
      }
      if (next && plannedDate.getTime() > new Date(next.plannedDate).getTime()) {
        throw new Error('VACCINE_DATE_INVALID')
      }
    }
    update.plannedDate = plannedDate
  }
  if (data.reminderEnabled !== undefined) update.reminderEnabled = Boolean(data.reminderEnabled)
  if (data.reminderDaysBefore !== undefined)
    update.reminderDaysBefore = Number(data.reminderDaysBefore)
  if (data.note !== undefined) update.note = text(data.note, 500)
  if (data.institution !== undefined) update.institution = text(data.institution, 80)
  if (data.paymentType === 'free' || data.paymentType === 'self_paid') {
    update.paymentType = data.paymentType
    update.selfPaidVaccineNote =
      data.paymentType === 'self_paid' ? text(data.selfPaidVaccineNote, 50) : ''
  }

  await db
    .collection('vaccines')
    .doc(event.vaccineId)
    .update({ data: { ...update, updatedAt: now() } })
  return result({ id: event.vaccineId })
}
