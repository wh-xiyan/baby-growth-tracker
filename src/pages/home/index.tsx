import { Button, Image, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePageDidShow } from '../../services/media-preview'
import { useSessionStore } from '../../stores/session'
import { Icon } from '../../components/icon'
import { MediaThumbnail, MediaThumbnails } from '../../components/media/MediaThumbnail'
import { PageLoading } from '../../components/page-loading'
import { consumeHomeRecordsRefresh, consumeRecordsUpdate } from '../../services/records'
import { getHomeOverview, type HomeOverview } from '../../services/home'
import { bootstrapSession } from '../../services/auth'
import { todayCare, localDate, localTime, measurementPoints } from '../../utils/home'
import { GrowthChart } from '../../components/growth-chart'
import growthTree from '../../assets/growth-tree.png'
import { completeVaccine, consumeVaccineUpdate, listHomeReminders } from '../../services/vaccines'
import type { HomeReminder } from '../../types/vaccine'
import { FamilyIdentity, GuestHome } from '../../components/FamilyIdentity'
import './index.scss'

const todayKey = () => localDate()

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

export default function Home() {
  const familyId = useSessionStore((state) => state.familyId)
  const childId = useSessionStore((state) => state.childId)
  const children = useSessionStore((state) => state.children)
  const initialized = useSessionStore((state) => state.initialized)
  const currentRole = useSessionStore((state) => state.currentRole)
  const setCurrentChild = useSessionStore((state) => state.setCurrentChild)
  const setSession = useSessionStore((state) => state.setSession)
  const [sessionRefreshing, setSessionRefreshing] = useState(false)
  const recordsSequence = useRef(0)
  const remindersSequence = useRef(0)
  const [switchVisible, setSwitchVisible] = useState(false)
  const [metric, setMetric] = useState<'height' | 'weight'>('height')
  const [overview, setOverview] = useState<HomeOverview>({ careRecords: [], measurements: [] })
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState(false)
  const [reminders, setReminders] = useState<HomeReminder[]>([])
  const [remindersLoading, setRemindersLoading] = useState(true)
  const [remindersError, setRemindersError] = useState(false)
  const [completingReminderId, setCompletingReminderId] = useState<string>()
  const [completionReminder, setCompletionReminder] = useState<HomeReminder>()
  const [completedDate, setCompletedDate] = useState(todayKey())
  const [institution, setInstitution] = useState('')
  const [completionNote, setCompletionNote] = useState('')
  const child = useMemo(
    () => children.find((item) => item.id === childId) || children[0],
    [childId, children],
  )
  const care = useMemo(() => todayCare(overview.careRecords, localDate()), [overview])
  const points = useMemo(() => measurementPoints(overview.measurements, metric), [overview, metric])
  const canEdit = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'adult'

  const refreshSession = async () => {
    if (sessionRefreshing) return
    setSessionRefreshing(true)
    try {
      const session = await bootstrapSession()
      setSession({
        ...session,
        userId: session.user.id,
        familyId: session.family?.id,
        childId: session.children.some((item) => item.id === childId)
          ? childId
          : session.currentChildId,
        currentRole: session.currentRole,
      })
      if (session.family && !session.currentRole) {
        Taro.showToast({ title: '未获取到家庭权限，请检查云端登录配置', icon: 'none' })
      }
    } catch (error) {
      console.error('同步家庭权限失败', error)
      Taro.showToast({ title: '权限同步失败，请重试', icon: 'none' })
    } finally {
      setSessionRefreshing(false)
    }
  }

  const loadTodayRecords = useCallback(async () => {
    const request = ++recordsSequence.current
    if (!initialized) return
    if (!familyId || !childId) {
      setOverview({ careRecords: [], measurements: [] })
      setRecordsLoading(false)
      return
    }
    setOverview({ careRecords: [], measurements: [] })
    setRecordsLoading(true)
    setRecordsError(false)
    try {
      const data = await getHomeOverview({ familyId, childId, date: todayKey() })
      if (request === recordsSequence.current) setOverview(data)
    } catch (error) {
      console.error('加载首页今日记录失败', error)
      if (request === recordsSequence.current) setRecordsError(true)
    } finally {
      if (request === recordsSequence.current) setRecordsLoading(false)
    }
  }, [childId, familyId, initialized])

  const loadReminders = useCallback(async () => {
    const request = ++remindersSequence.current
    if (!initialized) return
    if (!familyId || !childId) {
      setReminders([])
      setRemindersLoading(false)
      return
    }
    setReminders([])
    setRemindersLoading(true)
    setRemindersError(false)
    try {
      const data = await listHomeReminders({ familyId, childId, limit: 3 })
      if (request === remindersSequence.current) setReminders(data)
    } catch (error) {
      console.error('加载首页待办提醒失败', error)
      if (request === remindersSequence.current) setRemindersError(true)
    } finally {
      if (request === remindersSequence.current) setRemindersLoading(false)
    }
  }, [childId, familyId, initialized])

  useEffect(() => {
    // Guests remain in their personal space until they choose to associate a family.
  }, [familyId, initialized])

  useEffect(() => {
    loadTodayRecords()
  }, [loadTodayRecords])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  usePageDidShow(() => {
    consumeRecordsUpdate()
    consumeHomeRecordsRefresh()
    loadTodayRecords()
    consumeVaccineUpdate()
    loadReminders()
  })

  usePullDownRefresh(async () => {
    try {
      await loadTodayRecords()
      await loadReminders()
    } finally {
      Taro.stopPullDownRefresh()
    }
  })

  const openCompletion = (reminder: HomeReminder) => {
    if (!familyId || currentRole === 'viewer') return
    setCompletionReminder(reminder)
    setCompletedDate(todayKey())
    setInstitution('')
    setCompletionNote('')
  }

  const confirmCompletion = async () => {
    if (!familyId || !completionReminder) return
    const reminder = completionReminder
    setCompletingReminderId(reminder.id)
    try {
      await completeVaccine({
        familyId,
        vaccineId: reminder.id,
        completedDate,
        institution: institution.trim() || undefined,
        note: completionNote.trim() || undefined,
      })
      Taro.showToast({ title: '已标记接种', icon: 'success' })
      await loadReminders()
      setCompletionReminder(undefined)
    } catch (error) {
      console.error('完成疫苗接种失败', error)
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' })
    } finally {
      setCompletingReminderId(undefined)
    }
  }

  const navigateRecord = (category?: string) => {
    if (!canEdit) return
    Taro.navigateTo({ url: `/pages/record-edit/index${category ? `?category=${category}` : ''}` })
  }
  if (!initialized) return <PageLoading title='正在准备你的小家' caption='马上就好' />
  if (!familyId) return <GuestHome />

  const age = child ? ageOf(child.birthday) : '还未设置'

  return (
    <View className='home-page'>
      <View className='home-content'>
        <FamilyIdentity />
        <View className='home-header'>
          <View className='home-brand'>
            <Icon name='sapling' size={24} color='#7FA68A' />
            <Text>小树成长日记</Text>
          </View>
          <Button
            className='icon-button'
            onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}
          >
            <Icon name='config' size={18} color='#7FA68A' />
          </Button>
        </View>
        <View className='child-card'>
          <View className='child-card-body'>
            {child?.avatarFileId ? (
              <MediaThumbnails
                familyId={familyId}
                fileIds={[child.avatarFileId]}
                className='child-avatar-image'
                containerClassName='child-avatar-wrap'
                maxVisible={1}
              />
            ) : (
              <View className='child-avatar'>{child?.name?.slice(0, 1) || '宝'}</View>
            )}
            <View className='child-info'>
              <View className='child-name-row'>
                <Text className='child-name'>{child?.name || '添加宝宝'}</Text>
                <Text className='age-badge'>{age}</Text>
              </View>
              <Text className='child-note'>今天也在慢慢长大</Text>
            </View>
            <Button className='switch-child' onClick={() => setSwitchVisible(true)}>
              切换宝宝
              <Icon name='down' size={12} color='#7FA68A' />
            </Button>
          </View>
          <Image className='growth-tree' src={growthTree} mode='aspectFit' />
        </View>
        {canEdit && child && (
          <Button className='primary-button home-add-record' onClick={() => navigateRecord()}>
            ＋ 记一笔
          </Button>
        )}
        {!child && (
          <Button
            className='primary-button'
            onClick={() => Taro.navigateTo({ url: '/pages/child-profile/index' })}
          >
            完善宝宝档案
          </Button>
        )}
        {!canEdit && (
          <View className='readonly-notice'>
            <Text>
              {currentRole === 'viewer'
                ? '您当前为只读成员，可以查看成长记录'
                : '尚未获取家庭权限，请重新同步'}
            </Text>
            <Button
              loading={sessionRefreshing}
              disabled={sessionRefreshing}
              onClick={refreshSession}
            >
              同步权限
            </Button>
          </View>
        )}
        <View className='home-section'>
          <View className='section-heading'>
            <Text>今日照护</Text>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/record-list/index' })}>
              查看全部
            </Button>
          </View>
          {recordsLoading ? (
            <View className='record-state'>正在加载照护记录…</View>
          ) : recordsError ? (
            <Button className='record-state' onClick={loadTodayRecords}>
              数据加载失败，点击重试
            </Button>
          ) : (
            <>
              <View className='care-grid'>
                {(
                  [
                    {
                      category: 'feeding',
                      label: '喂养',
                      icon: 'baby-bottle',
                      value: `${care.feeds} 次`,
                      caption: care.latestFeed
                        ? `最近 ${localTime(care.latestFeed.occurredAt)}`
                        : '今日未记录',
                    },
                    {
                      category: 'sleep',
                      label: '睡眠',
                      icon: 'moon',
                      value: care.sleepMinutes
                        ? `${Math.floor(care.sleepMinutes / 60)}小时${care.sleepMinutes % 60}分`
                        : '未记录',
                      caption: '今日累计',
                    },
                    {
                      category: 'diaper',
                      label: '排便',
                      icon: 'plan',
                      value: `${care.diapers} 次`,
                      caption: care.latestDiaper
                        ? `最近 ${localTime(care.latestDiaper.occurredAt)}`
                        : '今日未记录',
                    },
                  ] as const
                ).map((item) => (
                  <View key={item.category} className={`care-card care-${item.category}`}>
                    <Button
                      className='care-summary'
                      onClick={() =>
                        Taro.navigateTo({
                          url: `/pages/record-list/index?category=${item.category}`,
                        })
                      }
                    >
                      <View className='care-icon'>
                        <Icon name={item.icon} size={20} color='#7FA68A' />
                      </View>
                      <Text className='care-label'>{item.label}</Text>
                      <Text className='care-value'>{item.value}</Text>
                      <Text className='care-caption'>{item.caption}</Text>
                    </Button>
                    {canEdit && (
                      <Button className='care-action' onClick={() => navigateRecord(item.category)}>
                        ＋ 记录{item.label}
                      </Button>
                    )}
                  </View>
                ))}
              </View>
              {canEdit && (
                <Button
                  className='primary-button'
                  onClick={() => Taro.navigateTo({ url: '/pages/record-edit/index?scene=care' })}
                >
                  ＋ 添加照护记录
                </Button>
              )}
            </>
          )}
        </View>
        <View className='home-section'>
          <View className='section-heading'>
            <Text>健康提醒</Text>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/vaccine/index' })}>
              查看计划
            </Button>
          </View>
          {remindersLoading ? (
            <View className='todo-empty'>正在加载疫苗计划…</View>
          ) : remindersError ? (
            <Button className='todo-state-button' onClick={loadReminders}>
              加载失败，点击重试
            </Button>
          ) : !reminders.length ? (
            <View className='todo-empty'>暂无待接种计划，前往疫苗页面查看或添加</View>
          ) : (
            <View className='todo-list'>
              {reminders.map((reminder) => (
                <View className='vaccine-card' key={reminder.id}>
                  <Text className='care-label'>
                    {reminder.urgency === 'upcoming' ? '下一次疫苗' : '待处理疫苗'}
                  </Text>
                  <View className='vaccine-title'>
                    <Text>
                      {reminder.vaccineName}
                      {reminder.doseNumber ? ` · 第${reminder.doseNumber}针` : ''}
                    </Text>
                    <Text className={`todo-status todo-status-${reminder.urgency}`}>
                      {reminder.relativeLabel}
                    </Text>
                  </View>
                  <Text className='vaccine-caption'>
                    {reminder.plannedDate}
                    {reminder.institution ? ` · ${reminder.institution}` : ''}
                  </Text>
                  <View className='vaccine-actions'>
                    <Button
                      onClick={() =>
                        Taro.navigateTo({
                          url: `/pages/vaccine-detail/index?id=${encodeURIComponent(reminder.id)}`,
                        })
                      }
                    >
                      查看疫苗详情 ›
                    </Button>
                    {canEdit && (
                      <Button className='todo-complete' onClick={() => openCompletion(reminder)}>
                        标记已接种
                      </Button>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        <View className='home-section'>
          <View className='section-heading'>
            <Text>成长数据</Text>
            <Button
              onClick={() => {
                Taro.setStorageSync('baby-growth-growth-entry', 'measurement')
                Taro.switchTab({ url: '/pages/growth/index' })
              }}
            >
              查看完整曲线
            </Button>
          </View>
          {recordsLoading ? (
            <View className='record-state'>正在加载成长数据…</View>
          ) : recordsError ? (
            <Button className='record-state' onClick={loadTodayRecords}>
              数据加载失败，点击重试
            </Button>
          ) : (
            <View className='measurement-card'>
              <View className='measurement-grid'>
                {(['height', 'weight'] as const).map((key) => {
                  const values = measurementPoints(overview.measurements, key)
                  const latest = values[values.length - 1]
                  const previous = values[values.length - 2]
                  return (
                    <Button
                      key={key}
                      className={`measurement-tile ${metric === key ? 'selected' : ''}`}
                      onClick={() => setMetric(key)}
                    >
                      <Text className='care-label'>{key === 'height' ? '身高' : '体重'}</Text>
                      <Text className='measurement-value'>
                        {latest ? `${latest.value} ${key === 'height' ? 'cm' : 'kg'}` : '未记录'}
                      </Text>
                      <Text className='care-caption'>
                        {previous && latest
                          ? `较上次 ${latest.value - previous.value >= 0 ? '+' : ''}${(latest.value - previous.value).toFixed(1)}`
                          : '等待更多测量'}
                      </Text>
                      <Text className='care-caption'>{latest?.date || ''}</Text>
                    </Button>
                  )
                })}
              </View>
              <GrowthChart points={points.slice(-12)} metric={metric} />
              {canEdit && (
                <Button className='measurement-add' onClick={() => navigateRecord('measurement')}>
                  ＋ 记录测量
                </Button>
              )}
            </View>
          )}
        </View>
        <View className='home-section'>
          <View className='section-heading'>
            <Text>最近学会</Text>
            <Button
              onClick={() => {
                Taro.setStorageSync('baby-growth-growth-entry', 'events')
                Taro.switchTab({ url: '/pages/growth/index' })
              }}
            >
              查看全部
            </Button>
          </View>
          {recordsLoading ? (
            <View className='record-state'>正在加载新发现…</View>
          ) : recordsError ? (
            <Button className='record-state' onClick={loadTodayRecords}>
              数据加载失败，点击重试
            </Button>
          ) : overview.milestone ? (
            <View
              className='activity-card'
              onClick={() =>
                Taro.navigateTo({ url: `/pages/record-detail/index?id=${overview.milestone?.id}` })
              }
            >
              <MediaThumbnail
                familyId={familyId}
                fileId={overview.milestone.mediaFileIds?.[0]}
                fileType={
                  overview.milestone.media?.find(
                    (item) => item.fileId === overview.milestone?.mediaFileIds?.[0],
                  )?.fileType
                }
                className='milestone-image'
              />
              <View className='activity-copy'>
                <Text className='activity-title'>{overview.milestone.title}</Text>
                <Text className='activity-time'>
                  {localDate(overview.milestone.occurredAt)} · {overview.milestone.authorName}记录
                </Text>
                <Text className='activity-caption'>{overview.milestone.content}</Text>
              </View>
            </View>
          ) : (
            <View className='todo-empty'>还没有记录新发现，留下宝宝的每一个第一次</View>
          )}
          {canEdit && (
            <Button className='primary-button' onClick={() => navigateRecord('milestone')}>
              ＋ 记录新发现
            </Button>
          )}
        </View>
      </View>
      {switchVisible && (
        <View className='record-mask' onClick={() => setSwitchVisible(false)}>
          <View className='record-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='sheet-heading'>
              <Text>切换宝宝</Text>
              <Button className='sheet-close' onClick={() => setSwitchVisible(false)}>
                关闭
              </Button>
            </View>
            {children.map((item) => (
              <Button
                className={`baby-choice ${item.id === childId ? 'active' : ''}`}
                key={item.id}
                onClick={() => {
                  setCurrentChild(item.id)
                  setSwitchVisible(false)
                  setCompletionReminder(undefined)
                }}
              >
                {item.name} · {ageOf(item.birthday)}
                {item.id === childId ? ' · 当前宝宝' : ''}
              </Button>
            ))}
            {canEdit && (
              <Button
                className='measurement-add'
                onClick={() => Taro.navigateTo({ url: '/pages/child-profile/index' })}
              >
                管理宝宝档案
              </Button>
            )}
          </View>
        </View>
      )}
      {completionReminder && (
        <View className='completion-mask' onClick={() => setCompletionReminder(undefined)}>
          <View className='completion-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='completion-heading'>标记已接种</View>
            <Text className='completion-vaccine'>
              {completionReminder.vaccineName}
              {completionReminder.doseNumber ? ` · 第 ${completionReminder.doseNumber} 针` : ''}
            </Text>
            <View className='completion-field'>
              <Text>实际接种日期</Text>
              <Picker
                mode='date'
                value={completedDate}
                onChange={(event) => setCompletedDate(event.detail.value)}
              >
                <View className='completion-picker'>{completedDate}</View>
              </Picker>
            </View>
            <View className='completion-field'>
              <Text>接种机构（选填）</Text>
              <Input
                className='completion-input'
                placeholder='例如：社区卫生服务中心'
                value={institution}
                onInput={(event) => setInstitution(event.detail.value)}
              />
            </View>
            <View className='completion-field'>
              <Text>备注（选填）</Text>
              <Textarea
                className='completion-textarea'
                placeholder='补充接种信息'
                value={completionNote}
                onInput={(event) => setCompletionNote(event.detail.value)}
              />
            </View>
            <View className='completion-actions'>
              <Button
                className='completion-cancel'
                onClick={() => setCompletionReminder(undefined)}
              >
                取消
              </Button>
              <Button
                className='completion-confirm'
                loading={Boolean(completingReminderId)}
                onClick={confirmCompletion}
              >
                确认完成
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
