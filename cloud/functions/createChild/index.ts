import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: {
  familyId?: string
  name?: string
  birthday?: string
  gender?: string
}) {
  const openid = context()
  const familyId = event?.familyId
  if (!familyId) throw new Error('INVALID_FAMILY')
  const member = await activeMember(familyId, openid)
  if (!['owner', 'adult'].includes(member.role)) throw new Error('FORBIDDEN')
  if (!event.name?.trim() || !event.birthday) throw new Error('INVALID_CHILD')
  const timestamp = now()
  const created = await db.collection('children').add({
    data: {
      familyId,
      name: event.name.trim(),
      birthday: event.birthday,
      gender: event.gender || 'unknown',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  })
  return result({
    id: created._id,
    familyId,
    name: event.name.trim(),
    birthday: event.birthday,
    gender: event.gender || 'unknown',
  })
}
