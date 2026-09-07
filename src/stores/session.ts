import { create } from 'zustand'

interface SessionState {
  userId?: string
  familyId?: string
  childId?: string
  setSession: (session: Partial<SessionState>) => void
  clear: () => void
}
export const useSessionStore = create<SessionState>((set) => ({
  setSession: (session) => set(session),
  clear: () => set({ userId: undefined, familyId: undefined, childId: undefined }),
}))
