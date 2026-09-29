import { Button, Image, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import { Icon } from '../../../components/icon'
import type { DailyRecord } from '../../../services/records'
import type { RecordMetrics } from '../../../types/record'
import { categoryMeta, type Filter } from '../constants'
import { durationLabel, timeOf } from '../utils'

export function Timeline({ records, filter }: { records: DailyRecord[]; filter: Filter }) {
  const [expandedId, setExpandedId] = useState<string>()
  const filteredRecords = useMemo(
    () =>
      records
        .filter((record) => filter === 'all' || record.category === filter)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [filter, records],
  )

  if (!filteredRecords.length) {
    return (
      <View className='empty-state'>
        <View className='empty-state-icon'>□</View>
        <Text className='empty-state-title'>今天还没有这类记录</Text>
        <Text className='empty-state-caption'>点击下方按钮，记录宝宝的每个小瞬间</Text>
      </View>
    )
  }

  return (
    <View className='timeline'>
      <View className='timeline-line' />
      {filteredRecords.map((record) => (
        <RecordItem
          key={record.id}
          record={record}
          expanded={expandedId === record.id}
          onToggle={() => setExpandedId(expandedId === record.id ? undefined : record.id)}
        />
      ))}
    </View>
  )
}

function RecordItem({
  record,
  expanded,
  onToggle,
}: {
  record: DailyRecord
  expanded: boolean
  onToggle: () => void
}) {
  const meta = categoryMeta[record.category] || categoryMeta.note
  const metrics = record.metrics || {}
  const media = record.mediaFileIds?.[0]
  const hasMedia = Boolean(
    media && (media.startsWith('http') || media.startsWith('wxfile://') || media.startsWith('/')),
  )

  return (
    <View className='timeline-item'>
      <View className='timeline-icon' style={{ backgroundColor: meta.background }}>
        <Icon name={meta.icon} size={20} color={meta.tone} />
      </View>
      <View className='record-item-card'>
        <View className='record-item-heading'>
          <View className='record-item-title-group'>
            <Text className='record-item-title'>{meta.label}</Text>
            {record.category === 'feeding' && (
              <Text className='record-tag'>{feedingLabel(metrics)}</Text>
            )}
          </View>
          <Text className='record-item-time'>{timeOf(record)}</Text>
        </View>
        {record.category === 'feeding' && <FeedingContent metrics={metrics} />}
        {record.category === 'sleep' && <SleepContent metrics={metrics} />}
        {record.category === 'milestone' && <GrowthContent record={record} metrics={metrics} />}
        {record.category === 'note' && (
          <View className='note-content'>
            {hasMedia && media && <Image className='note-image' src={media} mode='aspectFill' />}
            {record.content && <Text>{record.content}</Text>}
          </View>
        )}
        {(record.category === 'feeding' || record.category === 'sleep') && (
          <>
            <Button className='detail-toggle' onClick={onToggle}>
              <Text>查看详情</Text>
              <Text>{expanded ? '⌃' : '⌄'}</Text>
            </Button>
            {expanded && (
              <Text className='record-detail'>{record.content || detailText(record)}</Text>
            )}
          </>
        )}
      </View>
    </View>
  )
}

function feedingLabel(metrics: RecordMetrics) {
  if (metrics.feedingType === 'formula') return '奶粉'
  if (metrics.feedingType === 'solid_food') return '辅食'
  return '母乳'
}

function FeedingContent({ metrics }: { metrics: RecordMetrics }) {
  return (
    <View className='record-main-value'>
      <Text>{metrics.amount ?? metrics.durationMinutes ?? '--'}</Text>
      <Text className='record-unit'>{metrics.unit || (metrics.durationMinutes ? '分钟' : '')}</Text>
    </View>
  )
}

function SleepContent({ metrics }: { metrics: RecordMetrics }) {
  return (
    <View className='sleep-value'>
      <Text>{durationLabel(metrics.sleepDurationMinutes)}</Text>
      <Text className='record-tag sleep-tag'>小睡</Text>
    </View>
  )
}

function GrowthContent({ record, metrics }: { record: DailyRecord; metrics: RecordMetrics }) {
  return (
    <View className='growth-content'>
      <View className='growth-metrics'>
        <Text>
          {metrics.height ?? '--'}
          <Text className='metric-unit'> cm</Text>
        </Text>
        <Text>
          {metrics.weight ?? '--'}
          <Text className='metric-unit'> kg</Text>
        </Text>
      </View>
      {record.content && <Text className='growth-note'>{record.content}</Text>}
    </View>
  )
}

function detailText(record: DailyRecord) {
  if (record.category === 'sleep') {
    return `入睡 ${record.metrics?.sleepStart || '--:--'} · 醒来 ${record.metrics?.sleepEnd || '--:--'}`
  }
  return '暂无更多详情'
}
