import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../../stores/session'
import { Icon } from '../../components/icon'
import { MediaThumbnails } from '../../components/media/MediaThumbnail'
import { PageLoading } from '../../components/page-loading'
import {
  consumeHomeRecordsRefresh,
  consumeRecordsUpdate,
  listDailyRecords,
  type DailyRecord,
} from '../../services/records'
import type { RecordMetrics } from '../../types/record'
import { categoryMeta } from '../record-list/constants'
import './index.scss'

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function timeOf(record: DailyRecord) {
  return record.occurredAt.slice(11, 16) || '--:--'
}

function latestRecordsByCategory(records: DailyRecord[]) {
  const categories = new Set<string>()
  return [...records]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .filter((record) => {
      if (categories.has(record.category)) return false
      categories.add(record.category)
      return true
    })
}

function durationLabel(minutes?: number) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (!hours) return `${remainder} 分钟`
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`
}

function recordSummary(record: DailyRecord) {
  const metrics: RecordMetrics = record.metrics || {}
  if (record.category === 'feeding') {
    if (metrics.amount !== undefined) return `${metrics.amount} ${metrics.unit || 'ml'}`
    if (metrics.durationMinutes !== undefined) return `${metrics.durationMinutes} 分钟`
  }
  if (record.category === 'sleep') {
    return durationLabel(metrics.sleepDurationMinutes) || record.content || record.title
  }
  if (record.category === 'milestone') {
    const values = [
      metrics.height !== undefined ? `${metrics.height} cm` : '',
      metrics.weight !== undefined ? `${metrics.weight} kg` : '',
    ].filter(Boolean)
    if (values.length) return values.join(' · ')
  }
  return record.content || record.title
}

function ageOf(birthday: string) {
  const birth = new Date(birthday)
  const today = new Date()
  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth()
  const monthAnniversary = (offset: number) => {
    const year = birth.getFullYear() + Math.floor((birth.getMonth() + offset) / 12)
    const month = (birth.getMonth() + offset) % 12
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(birth.getDate(), lastDay))
  }
  if (monthAnniversary(months).getTime() > today.getTime()) months -= 1
  const days = Math.max(
    0,
    Math.floor((today.getTime() - monthAnniversary(months).getTime()) / 86400000),
  )
  if (months < 12) return `${Math.max(0, months)} 个月 ${days} 天`
  return `${Math.floor(months / 12)} 岁 ${months % 12} 个月`
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
  const [todayRecords, setTodayRecords] = useState<DailyRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState(false)
  const child = useMemo(
    () => children.find((item) => item.id === childId) || children[0],
    [childId, children],
  )
  const timelineRecords = useMemo(() => latestRecordsByCategory(todayRecords), [todayRecords])

  const loadTodayRecords = useCallback(async () => {
    if (!initialized) return
    if (!familyId || !childId) {
      setTodayRecords([])
      setRecordsLoading(false)
      return
    }
    setRecordsLoading(true)
    setRecordsError(false)
    try {
      setTodayRecords(await listDailyRecords({ familyId, childId, date: todayKey() }))
    } catch (error) {
      console.error('加载首页今日记录失败', error)
      setRecordsError(true)
    } finally {
      setRecordsLoading(false)
    }
  }, [childId, familyId, initialized])

  useEffect(() => {
    if (initialized && !familyId) Taro.navigateTo({ url: '/pages/onboarding/index' })
  }, [familyId, initialized])

  useEffect(() => {
    loadTodayRecords()
  }, [loadTodayRecords])

  useDidShow(() => {
    if (consumeRecordsUpdate() || consumeHomeRecordsRefresh()) loadTodayRecords()
  })

  usePullDownRefresh(async () => {
    try {
      await loadTodayRecords()
    } finally {
      Taro.stopPullDownRefresh()
    }
  })

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
          {recordsLoading && <View className='record-state'>正在加载今日记录...</View>}
          {!recordsLoading && recordsError && (
            <Button className='record-state record-state-button' onClick={loadTodayRecords}>
              加载失败，点击重试
            </Button>
          )}
          {!recordsLoading && !recordsError && !timelineRecords.length && (
            <View className='empty-record-card'>
              <View className='empty-icon'>✎</View>
              <View className='empty-title'>今天还没有记录</View>
              <View className='empty-caption'>喂养、睡眠、心情都值得被记下</View>
              <Button className='primary-button' onClick={() => setSheetVisible(true)}>
                ＋ <Text>记录今天</Text>
              </Button>
            </View>
          )}
          {!recordsLoading && !recordsError && timelineRecords.length > 0 && (
            <View className='home-record-timeline'>
              <View className='home-record-timeline-line' />
              {timelineRecords.map((record) => {
                const meta = categoryMeta[record.category] || categoryMeta.note
                return (
                  <View
                    className='home-record-item'
                    key={record.id}
                    onClick={() => Taro.navigateTo({ url: '/pages/record-list/index' })}
                  >
                    <Text className='home-record-time'>{timeOf(record)}</Text>
                    <View className='home-record-icon' style={{ backgroundColor: meta.background }}>
                      <Icon name={meta.icon} size={18} color={meta.tone} />
                    </View>
                    <View className='home-record-content'>
                      <Text className='home-record-category'>{meta.label}</Text>
                      <Text className='home-record-summary'>{recordSummary(record)}</Text>
                    </View>
                    {record.category === 'note' && familyId && (
                      <MediaThumbnails
                        className='home-record-thumbnail'
                        containerClassName='home-record-thumbnails'
                        familyId={familyId}
                        fileIds={record.mediaFileIds || []}
                        maxVisible={3}
                        moreClassName='home-record-thumbnail-more'
                        thumbnailItemClassName='home-record-thumbnail-item'
                      />
                    )}
                  </View>
                )
              })}
              <Button className='primary-button' onClick={() => setSheetVisible(true)}>
                ＋ <Text>记录今天</Text>
              </Button>
            </View>
          )}
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
