import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../stores/session'
import { getHomeOverview, type HomeOverview } from '../../services/home'
import { listRecords, type DailyRecord } from '../../services/records'
import { localDate, measurementPoints, isMeasurement } from '../../utils/home'
import { GrowthChart } from '../../components/growth-chart'
import { PageHeader } from '../../components/common'

export default function Growth() {
  const { familyId, childId, currentRole } = useSessionStore()
  const [overview, setOverview] = useState<HomeOverview>()
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [metric, setMetric] = useState<'height' | 'weight'>('height')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    setOverview(undefined)
    setRecords([])
    setError(false)
    setLoading(true)
    if (!familyId || !childId) {
      setLoading(false)
      return
    }
    try {
      const [data, history] = await Promise.all([
        getHomeOverview({ familyId, childId, date: localDate() }),
        listRecords({ familyId, childId, category: 'milestone', limit: 100 }),
      ])
      if (request === sequence.current) {
        setOverview(data)
        setRecords(history.filter((item) => !isMeasurement(item)))
      }
    } catch (cause) {
      console.error('加载成长数据失败', cause)
      if (request === sequence.current) setError(true)
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [familyId, childId])
  useEffect(() => {
    load()
    return () => {
      sequence.current += 1
    }
  }, [load])
  useDidShow(() => {
    load()
  })
  return (
    <View className='page'>
      <PageHeader title='成长' subtitle='看见变化，珍藏每一个第一次' />
      {loading ? (
        <View className='section muted'>正在加载成长记录…</View>
      ) : error ? (
        <Button onClick={load}>加载失败，重新加载</Button>
      ) : (
        <>
          <View className='section'>
            <View className='section-heading'>
              <Text>身体测量</Text>
              <Button onClick={() => setMetric(metric === 'height' ? 'weight' : 'height')}>
                {metric === 'height' ? '身高 · 切换体重' : '体重 · 切换身高'}
              </Button>
            </View>
            <GrowthChart
              points={measurementPoints(overview?.measurements || [], metric)}
              metric={metric}
            />
            {currentRole !== 'viewer' && (
              <Button
                onClick={() =>
                  Taro.navigateTo({ url: '/pages/record-edit/index?category=measurement' })
                }
              >
                记录测量
              </Button>
            )}
          </View>
          <View className='section'>
            <Text>成长里程碑</Text>
            {!records.length && <View className='empty-state'>还没有记录新发现</View>}
            {records.map((record) => (
              <View
                className='cell'
                key={record.id}
                onClick={() =>
                  Taro.navigateTo({ url: `/pages/record-detail/index?id=${record.id}` })
                }
              >
                <View>{record.title}</View>
                <Text className='muted'>
                  {localDate(record.occurredAt)} · {record.content}
                </Text>
              </View>
            ))}
            {currentRole !== 'viewer' && (
              <Button
                onClick={() =>
                  Taro.navigateTo({ url: '/pages/record-edit/index?category=milestone' })
                }
              >
                记录新发现
              </Button>
            )}
          </View>
        </>
      )}
    </View>
  )
}
