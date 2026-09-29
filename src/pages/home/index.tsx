import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../../stores/session'
import { Icon } from '../../components/icon'
import { PageLoading } from '../../components/page-loading'
import './index.scss'

function ageOf(birthday: string) {
  const birth = new Date(birthday)
  const today = new Date()
  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth()
  if (today.getDate() < birth.getDate()) months -= 1
  if (months < 1)
    return `${Math.max(0, Math.floor((today.getTime() - birth.getTime()) / 86400000))} 天`
  return months < 12 ? `${months} 个月` : `${Math.floor(months / 12)} 岁 ${months % 12} 个月`
}

function zodiacOf(birthday: string) {
  const date = new Date(birthday)
  const value = (date.getMonth() + 1) * 100 + date.getDate()
  const signs = [
    ['摩羯座', 1222, 131],
    ['水瓶座', 201, 218],
    ['双鱼座', 219, 320],
    ['白羊座', 321, 419],
    ['金牛座', 420, 520],
    ['双子座', 521, 621],
    ['巨蟹座', 622, 722],
    ['狮子座', 723, 822],
    ['处女座', 823, 922],
    ['天秤座', 923, 1023],
    ['天蝎座', 1024, 1122],
    ['射手座', 1123, 1221],
  ] as const
  return signs.find(([, start, end]) => value >= start && value <= end)?.[0] || '摩羯座'
}

export default function Home() {
  const familyId = useSessionStore((state) => state.familyId)
  const childId = useSessionStore((state) => state.childId)
  const children = useSessionStore((state) => state.children)
  const initialized = useSessionStore((state) => state.initialized)
  const setCurrentChild = useSessionStore((state) => state.setCurrentChild)
  const [sheetVisible, setSheetVisible] = useState(false)
  const child = useMemo(
    () => children.find((item) => item.id === childId) || children[0],
    [childId, children],
  )

  useEffect(() => {
    if (initialized && !familyId) Taro.navigateTo({ url: '/pages/onboarding/index' })
  }, [familyId, initialized])

  const navigateRecord = (category?: string) => {
    setSheetVisible(false)
    Taro.navigateTo({ url: `/pages/record-edit/index${category ? `?category=${category}` : ''}` })
  }
  const switchChild = () => {
    if (children.length < 2) return Taro.navigateTo({ url: '/pages/child-profile/index' })
    const index = children.findIndex((item) => item.id === child?.id)
    setCurrentChild(children[(index + 1) % children.length].id)
  }

  if (!initialized) return <PageLoading title='正在准备你的小家' caption='马上就好' />
  if (!familyId) return null

  const age = child ? ageOf(child.birthday) : '还未设置'
  const zodiac = child ? zodiacOf(child.birthday) : '成长中'
  return (
    <View className='home-page'>
      <View className='home-content'>
        <View className='home-header'>
          <View className='home-header-copy'>
            <View className='home-eyebrow'>TODAY WITH LOVE</View>
            <View className='home-title'>宝宝成长录</View>
            <View className='home-subtitle'>记录每一个值得记住的今天</View>
          </View>
          <Button
            className='icon-button'
            onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}
          >
            <Icon name='config' size={18} color='#E79576' />
          </Button>
        </View>
        <View className='child-card'>
          <View className='child-card-banner'>
            <View className='banner-copy'>
              ♥ <Text>宝宝今天 {age} 啦</Text>
            </View>
            <Button className='switch-child' onClick={switchChild}>
              <Text>切换宝宝</Text>
              <Icon name='down' size={12} color='#E79576' />
            </Button>
          </View>
          <View className='child-card-body'>
            <View className='child-avatar'>{child?.name?.slice(0, 1) || '宝'}</View>
            <View className='child-info'>
              <View className='child-name-row'>
                <Text className='child-name'>{child?.name || '我的宝宝'}</Text>
                <Text className='zodiac'>{zodiac}</Text>
              </View>
              <View className='child-age'>出生第 {age} · 每天都在长大</View>
              <View className='child-note'>✦ 每天都在解锁新本领</View>
            </View>
            <Button
              className='round-arrow'
              onClick={() => Taro.navigateTo({ url: '/pages/child-profile/index' })}
            >
              ›
            </Button>
          </View>
        </View>
        <View className='home-section'>
          <View className='section-heading'>
            <Text>今日记录</Text>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/record-list/index' })}>
              查看全部
            </Button>
          </View>
          <View className='empty-record-card'>
            <View className='empty-icon'>✎</View>
            <View className='empty-title'>今天还没有记录</View>
            <View className='empty-caption'>喂养、睡眠、心情都值得被记下</View>
            <Button className='primary-button' onClick={() => setSheetVisible(true)}>
              ＋ <Text>记录今天</Text>
            </Button>
          </View>
        </View>
        <View className='home-section'>
          <View className='section-heading'>
            <Text>待办提醒</Text>
          </View>
          <View className='todo-empty'>
            <Text>暂无待办事项</Text>
          </View>
        </View>
        <View className='home-section'>
          <View className='section-heading'>
            <Text>最近动态</Text>
            <Button onClick={() => Taro.switchTab({ url: '/pages/growth/index' })}>更多动态</Button>
          </View>
          <View
            className='activity-card'
            onClick={() => Taro.switchTab({ url: '/pages/growth/index' })}
          >
            <View className='activity-image'>♥</View>
            <View className='activity-copy'>
              <Text className='activity-title'>今天也有新的成长</Text>
              <Text className='activity-caption'>记录宝宝值得被记住的每一个瞬间</Text>
              <Text className='activity-time'>刚刚 · 等待你的记录</Text>
            </View>
          </View>
        </View>
        <View className='home-section'>
          <View className='section-heading'>
            <Text>快捷记录</Text>
          </View>
          <View className='quick-grid'>
            <Button className='quick-card quick-feed' onClick={() => navigateRecord('feeding')}>
              <View className='quick-icon'>
                <Icon name='baby-bottle' size={24} color='#E79576' />
              </View>
              <Text>喂养</Text>
            </Button>
            <Button className='quick-card quick-sleep' onClick={() => navigateRecord('sleep')}>
              <View className='quick-icon'>
                <Icon name='moon' size={24} color='#459DA1' />
              </View>
              <Text>睡眠</Text>
            </Button>
            <Button className='quick-card quick-growth' onClick={() => navigateRecord('milestone')}>
              <View className='quick-icon'>
                <Icon name='sapling' size={24} color='#BD8526' />
              </View>
              <Text>成长</Text>
            </Button>
            <Button className='quick-card quick-moment' onClick={() => navigateRecord('note')}>
              <View className='quick-icon'>
                <Icon name='camera' size={24} color='#8B71BD' />
              </View>
              <Text>瞬间</Text>
            </Button>
          </View>
        </View>
      </View>
      {sheetVisible && (
        <View className='record-mask' onClick={() => setSheetVisible(false)}>
          <View className='record-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='sheet-heading'>
              <View>
                <View className='sheet-title'>记录今天</View>
                <View className='sheet-caption'>选择你想留下的成长片段</View>
              </View>
              <Button className='sheet-close' onClick={() => setSheetVisible(false)}>
                ×
              </Button>
            </View>
            <View className='sheet-options'>
              <Button
                className='sheet-option option-pink'
                onClick={() => navigateRecord('feeding')}
              >
                <View className='sheet-option-icon'>
                  <Icon name='baby-bottle' size={24} color='#E79576' />
                </View>
                <Text>记录喂养</Text>
              </Button>
              <Button className='sheet-option option-blue' onClick={() => navigateRecord('note')}>
                <View className='sheet-option-icon'>
                  <Icon name='camera' size={24} color='#459DA1' />
                </View>
                <Text>记录瞬间</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
