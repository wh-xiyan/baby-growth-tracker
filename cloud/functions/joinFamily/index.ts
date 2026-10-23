import { familyMain } from '../../shared/family'
export async function main(event: Record<string, unknown>) {
  return familyMain({ ...event, code: event.code || event.inviteCode, action: 'join' })
}
