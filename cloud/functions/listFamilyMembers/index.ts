import { db, context, activeMember, result } from '../../shared/db'
export async function main(event: { familyId?: string }) {
  const openid = context(); const familyId = String(event?.familyId || ''); await activeMember(familyId, openid); const members = await db.collection('family_members').where({ familyId, status: 'active' }).get(); return result(members.data.map((item) => ({ ...item, id: item._id })))
}
