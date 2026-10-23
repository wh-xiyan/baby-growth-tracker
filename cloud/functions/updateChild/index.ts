import { ownedDocument } from '../../shared/records'
import { localDate } from '../../shared/home'
import { db, now, context, activeMember, result } from '../../shared/db'
export async function main(event: {
  familyId?: string
  childId?: string
  data?: Record<string, unknown>
}) {
  const openid = context()
  const familyId = String(event?.familyId || '')
  const member = await activeMember(familyId, openid, true)
  if (!['owner', 'admin'].includes(member.role)) throw new Error('FORBIDDEN')
  if (!event.childId || !event.data) throw new Error('INVALID_CHILD')
  await ownedDocument('children', event.childId, familyId)
  const data = event.data
  if (
    Object.keys(data).some((key) => !['name', 'birthday', 'gender'].includes(key)) ||
    (data.name !== undefined &&
      (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 50)) ||
    (data.gender !== undefined && !['male', 'female', 'unknown'].includes(String(data.gender)))
  )
    throw new Error('INVALID_CHILD')
  if (data.birthday !== undefined) {
    const value = String(data.birthday),
      date = new Date(value + 'T00:00:00Z')
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value ||
      value > localDate()
    )
      throw new Error('INVALID_CHILD')
  }
  await db
    .collection('children')
    .doc(event.childId)
    .update({ data: { ...data, updatedAt: now() } })
  return result({ id: event.childId })
}
