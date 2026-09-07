export interface MediaAsset {
  id: string
  familyId: string
  childId: string
  fileId: string
  fileType: 'image' | 'video'
  recordId?: string
  takenAt?: string
  caption?: string
  uploadedBy: string
  createdAt: string
}
