import { childData } from '../../../src/domain/family'
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
  const member = await activeMember(familyId, openid, true)
  if (!['owner', 'admin'].includes(member.role)) throw new Error('FORBIDDEN')
  const fields = childData(event)
  const timestamp = now()
  const created = await db.collection('children').add({
    data: {
      familyId,
      ...fields,
      scope: 'family',
      createdBy: member.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  })
  return result({
    id: created._id,
    familyId,
    ...fields,
  })
}
