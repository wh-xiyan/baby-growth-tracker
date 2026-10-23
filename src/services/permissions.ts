import { canWrite, canManage } from '../domain/family'
import { useSessionStore } from '../stores/session'

export function assertFamilyAccess(
  familyId: string,
  childId?: string,
  write = false,
  author?: string,
) {
  const s = useSessionStore.getState()
  if (
    s.sessionError ||
    !familyId ||
    s.familyId !== familyId ||
    !s.currentRole ||
    !['owner', 'admin', 'adult', 'viewer'].includes(s.currentRole) ||
    (childId && !s.children.some((c) => c.id === childId && c.familyId === familyId))
  )
    throw new Error('FORBIDDEN')
  if (
    write &&
    (Boolean(s.membershipIssue) ||
      !canWrite(s.currentRole) ||
      (author !== undefined && !canManage(s.currentRole, s.userId, author)))
  )
    throw new Error('FORBIDDEN')
  return s
}
