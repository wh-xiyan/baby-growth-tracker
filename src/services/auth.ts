import Taro from '@tarojs/taro'
import type { Child } from '../types/child'
import type { Family, User } from '../types/family'
import { callCloudFunction, isCloudConfigured } from './cloud'

export interface BootstrapResult {
  user: User
  family?: Family
  children: Child[]
  currentChildId?: string
  isDemo: boolean
}

const DEMO_KEY = 'baby-growth-demo-session'

function createDemoSession(): BootstrapResult {
  const now = new Date().toISOString()
  return {
    user: { id: 'demo-user', nickname: '我', createdAt: now, updatedAt: now },
    children: [],
    isDemo: true,
  }
}

export async function bootstrapSession(): Promise<BootstrapResult> {
  if (isCloudConfigured()) {
    await Taro.login()
    return callCloudFunction<BootstrapResult>('login')
  }
  return Taro.getStorageSync(DEMO_KEY) || createDemoSession()
}

export async function createFamilyAndChild(
  familyName: string,
  child: Omit<Child, 'id' | 'familyId' | 'createdAt' | 'updatedAt'>,
): Promise<BootstrapResult> {
  console.log('createFamilyAndChild', isCloudConfigured(), familyName, child)
  if (isCloudConfigured()) {
    const family = await callCloudFunction<Family>('createFamily', { name: familyName })
    const createdChild = await callCloudFunction<Child>('createChild', {
      familyId: family.id,
      ...child,
    })
    const session = await bootstrapSession()
    return {
      ...session,
      family,
      children: [createdChild],
      currentChildId: createdChild.id,
      isDemo: false,
    }
  }
  const current = (Taro.getStorageSync(DEMO_KEY) || createDemoSession()) as BootstrapResult
  const now = new Date().toISOString()
  const family: Family = {
    id: `demo-family-${Date.now()}`,
    name: familyName,
    ownerId: current.user.id,
    createdAt: now,
    updatedAt: now,
  }
  const createdChild: Child = {
    ...child,
    id: `demo-child-${Date.now()}`,
    familyId: family.id,
    createdAt: now,
    updatedAt: now,
  }
  const result: BootstrapResult = {
    ...current,
    family,
    children: [createdChild],
    currentChildId: createdChild.id,
    isDemo: true,
  }
  Taro.setStorageSync(DEMO_KEY, result)
  return result
}
