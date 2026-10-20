import { Button, Text, View } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import type { DailyRecord } from '../../../services/records'
import {
  careMetrics,
  careTitle,
  careValue,
  groupCare,
  type CareCategory,
} from '../../../utils/care-records'
import { localDate, localTime } from '../../../utils/home'

export function Timeline({
  records,
  queryKey,
  category,
}: {
  records: DailyRecord[]
  queryKey: string
  category: CareCategory
}) {
  const groups = groupCare(records)
  const [expansion, setExpansion] = useState<{ query: string; dates: Record<string, boolean> }>({
    query: '',
    dates: {},
  })
  const dates = expansion.query === queryKey ? expansion.dates : { [groups[0]?.[0] || '']: true }
  const toggle = (date: string) =>
    setExpansion({ query: queryKey, dates: { ...dates, [date]: !dates[date] } })
  const toggleAll = (open: boolean) =>
    setExpansion({
      query: queryKey,
      dates: Object.fromEntries(groups.map(([date]) => [date, open])),
    })
  if (!groups.length)
    return (
      <View className='care-empty'>
        <Text className='care-empty-title'>这段时间还没有这类记录</Text>
        <Text>试试扩大日期范围，或留下第一条记录。</Text>
      </View>
    )
  return (
    <View className='care-groups'>
      {groups.length > 1 && (
        <View className='care-group-tools'>
          <Text>
            {groups.length}个记录日 · {records.length}条记录
          </Text>
          <View>
            <Button onClick={() => toggleAll(true)}>全部展开</Button>
            <Button onClick={() => toggleAll(false)}>全部收起</Button>
          </View>
        </View>
      )}
      {groups.map(([date, rows]) => (
        <View className='care-date-group' key={date}>
          <Button className='care-date-heading' onClick={() => toggle(date)}>
            <View className='care-date-copy'>
              <Text className='care-date-title'>
                {date.slice(5).replace('-', '月')}日{date === localDate() ? ' · 今天' : ''}
              </Text>
              <Text className='care-date-brief'>
                {careMetrics(rows, category)
                  .map((m) => `${m.label} ${m.value}`)
                  .join(' · ')}
              </Text>
            </View>
            <Text className='care-date-toggle'>
              {rows.length}条　{dates[date] ? '收起 ⌃' : '展开 ⌄'}
            </Text>
          </Button>
          {dates[date] && (
            <View className='care-records'>
              {rows.map((record) => (
                <Button
                  className='care-record-row'
                  key={record.id}
                  onClick={() =>
                    Taro.navigateTo({
                      url: `/pages/record-detail/index?id=${encodeURIComponent(record.id)}`,
                    })
                  }
                >
                  <Text className='care-record-time'>{localTime(record.occurredAt)}</Text>
                  <View className='care-record-body'>
                    <Text className='care-record-title'>{careTitle(record)}</Text>
                    {careValue(record) && (
                      <Text className='care-record-value'>{careValue(record)}</Text>
                    )}
                    <Text className='care-record-caption'>
                      {record.metrics?.foods || record.content || '日常照护'} ·{' '}
                      {record.authorName || '家庭成员'}记录
                    </Text>
                  </View>
                  <Text className='care-record-arrow'>›</Text>
                </Button>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  )
}
