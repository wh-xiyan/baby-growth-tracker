import { db, activeMember, context, result, now } from '../../shared/db'
import { canManage } from '../../../src/domain/family'
export async function main(event: {
  familyId?: string
  vaccineId?: string
  action?: string
  expectedVersion?: number
  completedDate?: string
  institution?: string
  note?: string
}) {
  const familyId = String(event.familyId || ''),
    id = String(event.vaccineId || ''),
    member = await activeMember(familyId, context(), true)
  if (!id || !['update', 'delete'].includes(String(event.action)))
    throw new Error('INVALID_VACCINE')
  const target = await db.collection('vaccines').doc(id).get()
  if (!target.data || target.data.familyId !== familyId) throw new Error('NOT_FOUND')
  const siblings = await db
    .collection('vaccines')
    .where({
      familyId,
      childId: target.data.childId,
      ...(target.data.catalogId
        ? { catalogId: target.data.catalogId }
        : { name: target.data.name }),
    })
    .get()
  await db.runTransaction(async (tx: any) => {
    const found = await tx.collection('vaccines').doc(id).get(),
      v = found.data
    const actor = await tx.collection('family_members').doc(member._id).get()
    if (!v || v.familyId !== familyId || v.status !== 'completed') throw new Error('NOT_FOUND')
    if (
      !Number.isInteger(event.expectedVersion) ||
      event.expectedVersion !== (v.completionVersion || 0)
    )
      throw new Error('RECORD_CONFLICT')
    if (
      actor.data?.status !== 'active' ||
      !canManage(actor.data.role, member.userId, v.completedBy)
    )
      throw new Error('FORBIDDEN')
    const stamp = now()
    const date = new Date(String(event.completedDate))
    if (event.action === 'update' && (!Number.isFinite(date.getTime()) || date > stamp))
      throw new Error('INVALID_COMPLETED_DATE')
    for (const sibling of siblings.data) {
      if (sibling._id === id) continue
      const current = await tx.collection('vaccines').doc(sibling._id).get()
      if (current.data?.status !== 'completed') continue
      if (event.action === 'delete' && Number(current.data.doseNumber) > Number(v.doseNumber))
        throw new Error('LATER_DOSES_EXIST')
      if (
        event.action === 'update' &&
        ((Number(current.data.doseNumber) < Number(v.doseNumber) &&
          date < new Date(current.data.completedDate)) ||
          (Number(current.data.doseNumber) > Number(v.doseNumber) &&
            date > new Date(current.data.completedDate)))
      )
        throw new Error('VACCINE_COMPLETED_DATE_INVALID')
    }
    if (event.action === 'delete') {
      await tx
        .collection('vaccines')
        .doc(id)
        .update({
          data: {
            status: 'planned',
            completedDate: db.command.remove(),
            completedBy: db.command.remove(),
            completedNote: db.command.remove(),
            updatedAt: stamp,
            completionVersion: (v.completionVersion || 0) + 1,
          },
        })
      await tx
        .collection('vaccine_completion_events')
        .doc(id)
        .set({
          data: {
            familyId,
            childId: v.childId,
            vaccineId: id,
            createdBy: v.completedBy || '',
            deletedAt: stamp,
            updatedBy: member.userId,
            version: (v.completionVersion || 0) + 1,
          },
        })
    } else {
      const institution = String(event.institution || '').slice(0, 80),
        note = String(event.note || '').slice(0, 500)
      await tx
        .collection('vaccines')
        .doc(id)
        .update({
          data: {
            completedDate: date,
            institution,
            completedNote: note,
            updatedAt: stamp,
            completionVersion: (v.completionVersion || 0) + 1,
          },
        })
      await tx
        .collection('vaccine_completion_events')
        .doc(id)
        .set({
          data: {
            familyId,
            childId: v.childId,
            vaccineId: id,
            createdBy: v.completedBy || '',
            completedDate: date,
            institution,
            note,
            updatedBy: member.userId,
            updatedAt: stamp,
            version: (v.completionVersion || 0) + 1,
          },
        })
    }
  })
  return result({ id })
}
