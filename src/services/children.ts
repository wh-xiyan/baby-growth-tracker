import Taro from '@tarojs/taro'
import { callCloudFunction, isCloudConfigured } from './cloud'
import { useSessionStore } from '../stores/session'
import type { Child } from '../types/child'
import { requestHomeRecordsRefresh } from './records'

export async function updateChildProfile(
  child: Child,
  data: Pick<Child, 'name' | 'birthday' | 'gender'>,
) {
  const session = useSessionStore.getState()
  if (
    session.familyId !== child.familyId ||
    !['owner', 'adult'].includes(session.currentRole || '')
  )
    throw new Error('FORBIDDEN')
  if (isCloudConfigured())
    await callCloudFunction('updateChild', { familyId: child.familyId, childId: child.id, data })
  const current = useSessionStore.getState()
  if (current.familyId !== child.familyId) return
  const children = current.children.map((item) =>
    item.id === child.id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item,
  )
  useSessionStore.getState().setSession({ children })
  if (!isCloudConfigured()) {
    const saved = Taro.getStorageSync('baby-growth-demo-session')
    if (saved) Taro.setStorageSync('baby-growth-demo-session', { ...saved, children })
  }
  requestHomeRecordsRefresh()
}
