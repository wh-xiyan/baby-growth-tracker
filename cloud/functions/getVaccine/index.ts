import { context, activeMember, result } from '../../shared/db'
import { ownedDocument } from '../../shared/records'

export async function main(event: { familyId?: string; childId?: string; vaccineId?: string }) {
  const familyId = String(event.familyId || '')
  await activeMember(familyId, context())
  if (!event.vaccineId || !event.childId) throw new Error('INVALID_VACCINE')
  const vaccine = await ownedDocument('vaccines', event.vaccineId, familyId)
  if (vaccine.childId !== event.childId) throw new Error('NOT_FOUND')
  return result({ ...vaccine, id: vaccine._id })
}
