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
  const member = await activeMember(familyId, context(), true)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  const completedDate = new Date(event.completedDate)
  if (Number.isNaN(completedDate.getTime()) || completedDate > now())
    throw new Error('INVALID_COMPLETED_DATE')
  const vaccine = await db.collection('vaccines').doc(event.vaccineId).get()
  if (!vaccine.data || vaccine.data.familyId !== familyId) throw new Error('VACCINE_NOT_FOUND')
  if (vaccine.data.status === 'completed') return result({ id: event.vaccineId })
  if (vaccine.data.status !== 'planned') throw new Error('VACCINE_NOT_COMPLETABLE')
  let previousIds: string[] = []
  const doseNumber = Number(vaccine.data.doseNumber)
  if (vaccine.data.catalogId && doseNumber > 1) {
    const siblings = await db
      .collection('vaccines')
      .where({ familyId, childId: vaccine.data.childId, catalogId: vaccine.data.catalogId })
      .get()
    previousIds = siblings.data
      .filter((v: Record<string, any>) => Number(v.doseNumber) < doseNumber)
      .map((v: Record<string, any>) => v._id)
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
  await db.runTransaction(async (tx: any) => {
    const latest = await tx.collection('vaccines').doc(event.vaccineId).get()
    if (latest.data?.status !== 'planned') throw new Error('VACCINE_NOT_COMPLETABLE')
    const active = await tx.collection('family_members').doc(member._id).get()
    if (active.data?.status !== 'active' || !['owner', 'admin', 'adult'].includes(active.data.role))
      throw new Error('FORBIDDEN')
    for (const previousId of previousIds) {
      const previous = await tx.collection('vaccines').doc(previousId).get()
      if (previous.data?.status !== 'completed') throw new Error('PREVIOUS_DOSE_NOT_COMPLETED')
      if (completedDate < new Date(previous.data.completedDate))
        throw new Error('VACCINE_COMPLETED_DATE_INVALID')
    }
    const completionVersion = (latest.data.completionVersion || 0) + 1
    const completion = {
      familyId,
      childId: vaccine.data.childId,
      vaccineId: event.vaccineId,
      createdBy: member.userId,
      completedDate,
      institution: String(event.institution || '').slice(0, 80),
      note: String(event.note || '').slice(0, 500),
      createdAt: now(),
      updatedAt: now(),
      version: completionVersion,
    }
    await tx.collection('vaccine_completion_events').doc(event.vaccineId).set({ data: completion })
    await tx
      .collection('vaccines')
      .doc(event.vaccineId)
      .update({
        data: {
          status: 'completed',
          completedDate,
          institution: completion.institution,
          completedNote: completion.note,
          completedBy: member.userId,
          updatedAt: now(),
          completionVersion,
        },
      })
  })
  return result({ id: event.vaccineId })
}
