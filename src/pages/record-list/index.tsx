import { Button, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh, useUnload, useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { usePageDidShow } from '../../services/media-preview'
import { consumeRecordsUpdate, requestHomeRecordsRefresh } from '../../services/records'
import { useSessionStore } from '../../stores/session'
import { localDate } from '../../utils/home'
import {
  careMetrics,
  feedingLabels,
  filterCare,
  shiftDate,
  validRange,
  type CareCategory,
  type CareSubtype,
} from '../../utils/care-records'
import { Timeline } from './components/Timeline'
import { filterOptions } from './constants'
import { useDailyRecords } from './hooks/useDailyRecords'
import { FamilyIdentity } from '../../components/FamilyIdentity'
import './index.scss'

export default function RecordList({
  fixedCategory,
}: {
  fixedCategory?: 'feeding' | 'sleep' | 'diaper'
}) {
  const { familyId, childId, initialized, currentRole } = useSessionStore()
  const router = useRouter()
  const today = localDate()
  const [range, setRange] = useState({ start: today, end: today })
  const [filter, setFilter] = useState<CareCategory>(
    fixedCategory ||
      (filterOptions.some((item) => item.value === router.params.category)
        ? (router.params.category as CareCategory)
        : 'all'),
  )
  const [subtype, setSubtype] = useState<CareSubtype>('all')
  const [rangeVisible, setRangeVisible] = useState(false)
  const [draft, setDraft] = useState(range)
  const [rangeError, setRangeError] = useState('')
  const { records, loading, error, reload } = useDailyRecords({
    familyId,
    childId,
    initialized,
    startDate: range.start,
    endDate: range.end,
  })
  const visible = useMemo(() => filterCare(records, filter, subtype), [records, filter, subtype])
  const queryKey = [familyId, childId, range.start, range.end, filter, subtype].join('|')
  const canEdit = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'adult'
  const addRecord = () => {
    const query = filter === 'all' ? 'scene=care' : `category=${filter}`
    const date = range.start === range.end ? range.end : today
    Taro.navigateTo({ url: `/pages/record-edit/index?${query}&date=${date}` })
  }
  const openRange = () => {
    setDraft(range)
    setRangeError('')
    setRangeVisible(true)
  }
  const applyRange = () => {
    if (!validRange(draft.start, draft.end)) {
      setRangeError('请选择有效日期，结束日期需不早于开始日期且不晚于今天。')
      return
    }
    setRange(draft)
    setRangeVisible(false)
  }
  usePageDidShow(() => {
    if (consumeRecordsUpdate()) void reload()
  })
  useUnload(() => {
    requestHomeRecordsRefresh()
  })
  usePullDownRefresh(async () => {
    try {
      await reload()
    } finally {
      Taro.stopPullDownRefresh()
    }
  })
  return (
    <View className={`record-list-page ${!canEdit ? 'care-readonly' : ''}`}>
      <FamilyIdentity />
      <View className='care-page-heading'>
        <Text className='care-eyebrow'>小树成长日记</Text>
        <Text className='care-page-title'>每一笔，都是用心</Text>
      </View>
      <View className='care-query'>
        <Button className='care-range-button' onClick={openRange}>
          <View>
            <Text className='care-caption'>查询日期范围</Text>
            <Text className='care-range-value'>
              {range.start === range.end
                ? `${range.end}${range.end === today ? ' · 今天' : ''}`
                : `${range.start} — ${range.end}`}
            </Text>
          </View>
          <Text className='care-caption'>选择日期 ›</Text>
        </Button>
        <View className='care-presets'>
          {[
            { days: 1, label: '今天' },
            { days: 7, label: '近7天' },
            { days: 30, label: '近30天' },
          ].map(({ days, label }) => (
            <Button
              key={days}
              className={`care-chip ${range.end === today && range.start === shiftDate(today, 1 - days) ? 'active' : ''}`}
              onClick={() => setRange({ start: shiftDate(today, 1 - days), end: today })}
            >
              {label}
            </Button>
          ))}
          <Button className='care-chip' onClick={openRange}>
            自定义
          </Button>
        </View>
        <ScrollView scrollX className='care-tabs-scroll'>
          <View className='care-tabs'>
            {filterOptions.map((item) => (
              <Button
                key={item.value}
                className={`care-tab ${filter === item.value ? 'active' : ''}`}
                onClick={() => {
                  setFilter(item.value as CareCategory)
                  setSubtype('all')
                }}
              >
                {item.label}
              </Button>
            ))}
          </View>
        </ScrollView>
        {filter === 'feeding' && (
          <View className='care-subtypes'>
            {[
              { value: 'all', label: '全部喂养' },
              ...Object.entries(feedingLabels).map(([value, label]) => ({ value, label })),
            ].map((item) => (
              <Button
                className={`care-chip ${subtype === item.value ? 'active' : ''}`}
                key={item.value}
                onClick={() => setSubtype(item.value as CareSubtype)}
              >
                {item.label}
              </Button>
            ))}
          </View>
        )}
        {!loading && !error && (
          <>
            <View className='care-metrics'>
              {careMetrics(visible, filter).map((metric) => (
                <View key={metric.label} className='care-metric'>
                  <Text className='care-metric-value'>{metric.value}</Text>
                  <Text className='care-caption'>{metric.label}</Text>
                </View>
              ))}
            </View>
            {filter === 'feeding' && (
              <Text className='care-stat-hint'>母乳按时长、配方奶按奶量、辅食按次数分别记录。</Text>
            )}
          </>
        )}
        {filter === 'sleep' && !loading && !error && (
          <Text className='care-stat-hint'>按记录日期汇总完整睡眠时长，跨日睡眠计入记录当天。</Text>
        )}
      </View>
      <View className='care-list-content'>
        {loading ? (
          <View className='care-state'>正在加载照护记录…</View>
        ) : error ? (
          <Button className='care-state' onClick={reload}>
            记录加载失败，点击重试
          </Button>
        ) : (
          <Timeline records={visible} queryKey={queryKey} category={filter} />
        )}
      </View>
      {canEdit && (
        <View className='care-add-dock'>
          <Button className='care-primary' onClick={addRecord}>
            ＋{' '}
            {filter === 'all'
              ? '添加照护记录'
              : `添加${filterOptions.find((item) => item.value === filter)?.label}`}
          </Button>
        </View>
      )}
      {rangeVisible && (
        <View className='care-range-mask' onClick={() => setRangeVisible(false)}>
          <View className='care-range-sheet' onClick={(event) => event.stopPropagation()}>
            <Text className='care-sheet-title'>选择日期范围</Text>
            <Text className='care-field-label'>开始日期</Text>
            <Picker
              mode='date'
              value={draft.start}
              end={today}
              onChange={(event) => setDraft({ ...draft, start: event.detail.value })}
            >
              <View className='care-date-input'>{draft.start}</View>
            </Picker>
            <Text className='care-field-label'>结束日期</Text>
            <Picker
              mode='date'
              value={draft.end}
              start={draft.start}
              end={today}
              onChange={(event) => setDraft({ ...draft, end: event.detail.value })}
            >
              <View className='care-date-input'>{draft.end}</View>
            </Picker>
            {rangeError && <Text className='care-range-error'>{rangeError}</Text>}
            <View className='care-sheet-actions'>
              <Button className='care-secondary' onClick={() => setRangeVisible(false)}>
                取消
              </Button>
              <Button className='care-primary' onClick={applyRange}>
                确认范围
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
