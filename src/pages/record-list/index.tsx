import { Button, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { PageLoading } from '../../components/page-loading'
import { useSessionStore } from '../../stores/session'
import { SummaryCard } from './components/SummaryCard'
import { Timeline } from './components/Timeline'
import { filterOptions, type Filter } from './constants'
import { useDailyRecords } from './hooks/useDailyRecords'
import { dateKey, parseDateKey } from './utils'
import './index.scss'

export default function RecordList() {
  const familyId = useSessionStore((state) => state.familyId)
  const childId = useSessionStore((state) => state.childId)
  const initialized = useSessionStore((state) => state.initialized)
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [filter, setFilter] = useState<Filter>('all')
  const { records, loading, error, reload } = useDailyRecords({
    familyId,
    childId,
    initialized,
    date: selectedDate,
  })
  const selectedDateValue = parseDateKey(selectedDate)
  const isToday = selectedDate === dateKey(new Date())
  const shortDateLabel = `${selectedDateValue.getFullYear()}年${selectedDateValue.getMonth() + 1}月${selectedDateValue.getDate()}日`
  const weekdayLabel = `星期${'日一二三四五六'[selectedDateValue.getDay()]}${isToday ? ' · 今天' : ''}`

  return (
    <View className='record-list-page'>
      <PageLoading visible={loading} />
      <View className='list-header'>
        <Picker
          className='list-date-picker'
          mode='date'
          value={selectedDate}
          onChange={(event) => {
            setSelectedDate(event.detail.value)
            setFilter('all')
          }}
        >
          <View className='list-date-summary'>
            <Text className='list-title'>{shortDateLabel}</Text>
            <Text className='list-date'>{weekdayLabel}</Text>
          </View>
        </Picker>
        {/* <Picker
          className='list-calendar-picker'
          mode='date'
          value={selectedDate}
          onChange={(event) => {
            setSelectedDate(event.detail.value)
            setFilter('all')
          }}
        >
          <View className='list-icon-button list-calendar'>
            <View className='calendar-glyph' />
          </View>
        </Picker> */}
      </View>

      <View className='list-content'>
        <SummaryCard records={records} />
        <View className='timeline-heading'>
          <Text>时间线</Text>
          <Text className='sort-label'>↓ 按时间</Text>
        </View>
        <ScrollView className='filters' scrollX>
          <View className='filters-track'>
            {filterOptions.map((item) => (
              <Button
                key={item.value}
                className={`filter-button ${filter === item.value ? 'active' : ''}`}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </View>
        </ScrollView>

        {loading && <View className='list-state'>正在加载今日记录...</View>}
        {!loading && error && (
          <Button className='list-state list-state-button' onClick={reload}>
            今日记录加载失败，点击重试
          </Button>
        )}
        {!loading && !error && <Timeline records={records} filter={filter} />}
      </View>

      <Button
        className='add-record-button'
        onClick={() => Taro.navigateTo({ url: '/pages/record-edit/index' })}
      >
        ＋ <Text>添加记录</Text>
      </Button>
    </View>
  )
}
