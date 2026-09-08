import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { useSessionStore } from '../../stores/session'
import './index.scss'
import { PageHeader, SectionCard, SectionTitle, PrimaryButton } from '../../components/common'

export default function Home() {
  const familyId = useSessionStore((state) => state.familyId)
  const initialized = useSessionStore((state) => state.initialized)
  useEffect(() => {
    if (initialized && !familyId) Taro.navigateTo({ url: '/pages/onboarding/index' })
  }, [familyId, initialized])
  const addRecord = () => Taro.navigateTo({ url: '/pages/record-edit/index' })
  if (!initialized || !familyId)
    return (
      <View className='home-loading'>
        <View className='home-loading-icon'>🍼</View>
        <View className='home-loading-title'>正在准备你的小家</View>
        <View className='home-loading-caption'>马上就好，先抱抱期待</View>
      </View>
    )
  return (
    <View className='page home-page'>
      <PageHeader
        title='宝宝成长录'
        subtitle='记录每一个值得记住的今天'
        eyebrow='TODAY WITH LOVE'
      />
      <SectionCard className='hero'>
        <View className='hero-name'>宝宝档案</View>
        <View className='muted'>完成家庭和宝宝设置后，这里会显示年龄与成长概览</View>
      </SectionCard>
      <SectionCard>
        <SectionTitle>今日记录</SectionTitle>
        <View className='muted'>还没有记录，先记下宝宝今天的小事吧</View>
        <PrimaryButton onClick={addRecord}>记录今天</PrimaryButton>
      </SectionCard>
      <SectionCard>
        <SectionTitle>待办提醒</SectionTitle>
        <View className='muted'>暂无即将到期的疫苗提醒</View>
      </SectionCard>
    </View>
  )
}
