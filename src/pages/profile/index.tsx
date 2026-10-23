import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Cell, CellList, PageHeader } from '../../components/common'
import { FamilyIdentity } from '../../components/FamilyIdentity'
import { refreshFamilySession, familyError } from '../../services/family'
import { usePageDidShow } from '../../services/media-preview'
import { useSessionStore } from '../../stores/session'

export default function Profile() {
  const { family } = useSessionStore(),
    [error, setError] = useState('')
  const refresh = () => {
    void refreshFamilySession()
      .then(() => setError(''))
      .catch((cause) => setError(familyError(cause)))
  }
  usePageDidShow(refresh)
  return (
    <View className='page'>
      <PageHeader
        title='我的'
        subtitle={family?.name || '个人成长空间'}
        eyebrow='OUR LITTLE HOME'
      />
      <FamilyIdentity />
      {error && (
        <View>
          <Text>{error}</Text>
          <Button onClick={refresh}>重新同步</Button>
        </View>
      )}
      <CellList>
        <Cell onClick={() => Taro.navigateTo({ url: '/pages/family/index' })}>
          {family ? '我的家庭' : '关联家庭'} · 身份、成员与申请
        </Cell>
        <Cell onClick={() => Taro.navigateTo({ url: '/pages/child-profile/index' })}>宝宝资料</Cell>
        <Cell onClick={() => Taro.navigateTo({ url: '/pages/onboarding/index' })}>
          建立个人宝宝档案
        </Cell>
        <Cell onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          设置与数据导出
        </Cell>
      </CellList>
    </View>
  )
}
