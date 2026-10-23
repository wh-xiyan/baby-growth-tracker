export type FamilyRole = 'owner' | 'admin' | 'adult' | 'viewer'
export interface User {
  id: string
  openid?: string
  nickname: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}
export interface FamilyMember {
  id: string
  familyId: string
  userId: string
  role: FamilyRole
  displayName: string
  status: 'active' | 'removed'
  relationshipCode?: string
  version?: number
  permissionSource?: string
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

export interface FamilyRequest {
  id: string
  userId: string
  familyId: string
  type: 'join' | 'identity_change' | 'child_attach'
  payload: { displayName?: string; identity?: string; role?: FamilyRole; childId?: string }
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  version: number
  createdAt: string
}
export interface FamilyOverview {
  legacyFamilies?: { id: string; name: string; role: FamilyRole }[]
  personalChildren: import('./child').Child[]
  members: FamilyMember[]
  requests: FamilyRequest[]
  familyRequests: FamilyRequest[]
  invitations: { id: string; expiresAt: string; usedCount: number; maxUses: number }[]
}
