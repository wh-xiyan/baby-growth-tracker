import { db, now, context, activeMember, result } from '../../shared/db'

export async function main(event: {
  familyId?: string
  vaccineId?: string
  completedDate?: string
  institution?: string
  note?: string
}) {
  const familyId = String(event?.familyId || '')
  if (!familyId || !event?.vaccineId || !event.completedDate) throw new Error('INVALID_VACCINE')
  const member = await activeMember(familyId, context())
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  const completedDate = new Date(event.completedDate)
  if (Number.isNaN(completedDate.getTime())) throw new Error('INVALID_COMPLETED_DATE')
  const vaccine = await db.collection('vaccines').doc(event.vaccineId).get()
  if (!vaccine.data || vaccine.data.familyId !== familyId) throw new Error('VACCINE_NOT_FOUND')
  if (vaccine.data.status === 'completed') return result({ id: event.vaccineId })
  if (vaccine.data.status !== 'planned') throw new Error('VACCINE_NOT_COMPLETABLE')
  const doseNumber = Number(vaccine.data.doseNumber)
  if (vaccine.data.catalogId && doseNumber > 1) {
    const siblings = await db
      .collection('vaccines')
      .where({ familyId, childId: vaccine.data.childId, catalogId: vaccine.data.catalogId })
      .get()
    const previousDoses = siblings.data.filter(
      (item: Record<string, any>) => Number(item.doseNumber) < doseNumber,
    )
    if (
      previousDoses.length !== doseNumber - 1 ||
      previousDoses.some((item: Record<string, any>) => item.status !== 'completed')
    ) {
      throw new Error('PREVIOUS_DOSE_NOT_COMPLETED')
    }
    const previous = previousDoses.find(
      (item: Record<string, any>) => Number(item.doseNumber) === doseNumber - 1,
    )
    if (
      previous?.completedDate &&
      completedDate.getTime() < new Date(previous.completedDate).getTime()
    ) {
      throw new Error('VACCINE_COMPLETED_DATE_INVALID')
    }
  }
  await db
    .collection('vaccines')
    .doc(event.vaccineId)
    .update({
      data: {
        status: 'completed',
        completedDate,
        institution: event.institution ? String(event.institution) : '',
        completedNote: event.note ? String(event.note) : '',
        completedBy: member.userId,
        updatedAt: now(),
      },
    })
  return result({ id: event.vaccineId })
}
