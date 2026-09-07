import { create } from 'zustand'
import type { Child } from '../types/child'
import type { Family, User } from '../types/family'

interface SessionState {
  user?: User
  family?: Family
  children: Child[]
  userId?: string
  familyId?: string
  childId?: string
  initialized: boolean
  setInitialized: (initialized: boolean) => void
  setSession: (session: Partial<SessionState>) => void
  setCurrentChild: (childId: string) => void
  clear: () => void
}
export const useSessionStore = create<SessionState>((set) => ({
  children: [],
  initialized: false,
  setInitialized: (initialized) => set({ initialized }),
  setSession: (session) => set(session),
  setCurrentChild: (childId) => set({ childId }),
  clear: () =>
    set({
      user: undefined,
      family: undefined,
      children: [],
      userId: undefined,
      familyId: undefined,
      childId: undefined,
      initialized: false,
    }),
}))
