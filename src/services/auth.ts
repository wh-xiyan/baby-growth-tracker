import Taro from '@tarojs/taro'
import { demoSession, restoreChildSelection } from './family'
import type { Child } from '../types/child'
import type { Family, FamilyMember, FamilyRole, User } from '../types/family'
import { callCloudFunction, isCloudConfigured } from './cloud'

export interface BootstrapResult {
  user: User
  family?: Family
  children: Child[]
  currentChildId?: string
  currentRole?: FamilyRole
  membership?: FamilyMember
  personalChildren?: Child[]
  membershipIssue?: string
  isDemo: boolean
}

export async function bootstrapSession(): Promise<BootstrapResult> {
  if (isCloudConfigured()) {
    await Taro.login()
    return restoreChildSelection(await callCloudFunction<BootstrapResult>('login'))
  }
  return restoreChildSelection(demoSession())
}
