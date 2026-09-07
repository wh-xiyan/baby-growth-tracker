export interface Child {
  id: string
  familyId: string
  name: string
  gender?: 'male' | 'female' | 'unknown'
  birthday: string
  avatarFileId?: string
  createdAt: string
  updatedAt: string
}
