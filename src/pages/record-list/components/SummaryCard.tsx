import { Text, View } from '@tarojs/components'
import { durationLabel } from '../utils'
import type { DailyRecord } from '../../../services/records'

export function SummaryCard({ records }: { records: DailyRecord[] }) {
  const feedingCount = records.filter((record) => record.category === 'feeding').length
  const sleepMinutes = records
    .filter((record) => record.category === 'sleep')
    .reduce((total, record) => total + (record.metrics?.sleepDurationMinutes || 0), 0)

  return (
    <View className='summary-card'>
      <SummaryItem value={records.length} label='今日记录' />
      <SummaryItem value={feedingCount} label='喂养次数' tone='coral' />
      <SummaryItem value={durationLabel(sleepMinutes)} label='睡眠时长' tone='teal' />
    </View>
  )
}

function SummaryItem({
  value,
  label,
  tone = 'ink',
}: {
  value: string | number
  label: string
  tone?: string
}) {
  return (
    <View className={`summary-item summary-${tone}`}>
      <Text className='summary-value'>{value}</Text>
      <Text className='summary-label'>{label}</Text>
    </View>
  )
}
