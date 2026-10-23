import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { Child } from '../types/child'
import type { Family, FamilyMember, FamilyRole, User } from '../types/family'

interface SessionState {
  user?: User
  family?: Family
  children: Child[]
  userId?: string
  familyId?: string
  childId?: string
  currentRole?: FamilyRole
  membership?: FamilyMember
  personalChildren?: Child[]
  membershipIssue?: string
  sessionError?: string
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
  setCurrentChild: (childId) =>
    set((state) => {
      if (!state.children.some((child) => child.id === childId)) return {}
      Taro.setStorageSync(
        `baby-growth-last-child-${state.userId}-${state.familyId || 'personal'}`,
        childId,
      )
      return { childId }
    }),
  clear: () =>
    set({
      user: undefined,
      family: undefined,
      children: [],
      userId: undefined,
      familyId: undefined,
      childId: undefined,
      currentRole: undefined,
      membership: undefined,
      personalChildren: [],
      membershipIssue: undefined,
      initialized: false,
    }),
}))
