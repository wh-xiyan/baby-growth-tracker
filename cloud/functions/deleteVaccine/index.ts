import { activeMember, context, db, now, result } from '../../shared/db'

export async function main(event: { familyId?: string; vaccineId?: string; force?: boolean }) {
  const familyId = String(event?.familyId || '')
  if (!familyId || !event?.vaccineId) throw new Error('INVALID_VACCINE')
  const member = await activeMember(familyId, context(), true)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  const vaccine = await db.collection('vaccines').doc(event.vaccineId).get()
  if (!vaccine.data || vaccine.data.familyId !== familyId) throw new Error('VACCINE_NOT_FOUND')
  if (!['owner', 'admin'].includes(member.role) && vaccine.data.createdBy !== member.userId)
    throw new Error('FORBIDDEN')
  if (vaccine.data.status === 'completed') throw new Error('COMPLETED_VACCINE_IMMUTABLE')

  const siblings = await db
    .collection('vaccines')
    .where({
      familyId,
      childId: vaccine.data.childId,
      catalogId: vaccine.data.catalogId,
    })
    .get()
  const laterPlans = siblings.data.some(
    (item: Record<string, any>) =>
      Number(item.doseNumber) > Number(vaccine.data.doseNumber) && item.status === 'planned',
  )
  if (laterPlans && !event.force) throw new Error('LATER_DOSES_EXIST')

  await db.collection('vaccines').doc(event.vaccineId).remove()
  if (vaccine.data.seriesId) {
    const remaining = await db
      .collection('vaccines')
      .where({ seriesId: vaccine.data.seriesId })
      .limit(1)
      .get()
    if (!remaining.data[0])
      await db.collection('vaccine_series').doc(vaccine.data.seriesId).remove()
    else
      await db
        .collection('vaccine_series')
        .doc(vaccine.data.seriesId)
        .update({ data: { updatedAt: now() } })
  }
  return result({ id: event.vaccineId })
}
