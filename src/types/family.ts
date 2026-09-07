export type FamilyRole = 'owner' | 'adult' | 'viewer'
export interface FamilyMember {
  id: string
  familyId: string
  userId: string
  role: FamilyRole
  displayName: string
  status: 'active' | 'removed'
  joinedAt: string
}
export interface Family {
  id: string
  name: string
  ownerId: string
  inviteCode?: string
  createdAt: string
  updatedAt: string
}
