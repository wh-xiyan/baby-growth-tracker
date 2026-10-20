import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getVaccine } from '../../services/vaccines'
import { useSessionStore } from '../../stores/session'
import type { Vaccine } from '../../types/vaccine'
import './index.scss'

const statusLabels = { planned: '待接种', completed: '已接种', skipped: '已跳过' }

export default function VaccineDetail() {
  const { params } = useRouter()
  const { familyId, childId, initialized } = useSessionStore()
  const [vaccine, setVaccine] = useState<Vaccine>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    if (!initialized) return
    setVaccine(undefined)
    setLoading(true)
    setError('')
    try {
      if (!familyId || !childId || !params.id) throw new Error('INVALID_VACCINE')
      const data = await getVaccine({ familyId, childId, vaccineId: params.id })
      if (request === sequence.current) setVaccine(data)
    } catch (cause) {
      console.error('加载疫苗详情失败', cause)
      if (request === sequence.current) setError('无法加载此疫苗，可能已删除或暂无查看权限。')
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [initialized, familyId, childId, params.id])
  useEffect(() => {
    void load()
  }, [load])
  useDidShow(() => {
    void load()
  })
  usePullDownRefresh(async () => {
    try {
      await load()
    } finally {
      Taro.stopPullDownRefresh()
    }
  })
  return (
    <View className='vaccine-detail-page'>
      {loading ? (
        <View className='detail-state'>正在加载疫苗详情…</View>
      ) : error ? (
        <View className='detail-state'>
          <Text>{error}</Text>
          <Button className='primary-button' onClick={load}>
            重新加载
          </Button>
        </View>
      ) : vaccine ? (
        <>
          <View className='detail-title'>{vaccine.name}</View>
          <View className='detail-subtitle'>
            第 {vaccine.doseNumber || 1} 针
            {vaccine.totalDoses ? ` / 共 ${vaccine.totalDoses} 针` : ''} ·{' '}
            {statusLabels[vaccine.status]}
          </View>
          <View className='detail-card'>
            <Field label='计划接种日期' value={vaccine.plannedDate} />
            <Field label='实际接种日期' value={vaccine.completedDate || '尚未接种'} />
            <Field label='接种机构' value={vaccine.institution || '未填写'} />
            <Field
              label='费用类型'
              value={
                vaccine.paymentType === 'self_paid'
                  ? '自费'
                  : vaccine.paymentType === 'free'
                    ? '免费'
                    : '未填写'
              }
            />
            {vaccine.selfPaidVaccineNote && (
              <Field label='自费说明' value={vaccine.selfPaidVaccineNote} />
            )}
            <Field
              label='提醒设置'
              value={
                vaccine.reminderEnabled
                  ? `提前 ${vaccine.reminderDaysBefore ?? 7} 天提醒`
                  : '未开启'
              }
            />
            <Field label='计划备注' value={vaccine.note || '无'} />
            {vaccine.completedNote && <Field label='接种备注' value={vaccine.completedNote} />}
          </View>
          <Button
            className='primary-button'
            onClick={() => Taro.navigateTo({ url: '/pages/vaccine/index' })}
          >
            查看全部疫苗计划 ›
          </Button>
        </>
      ) : null}
    </View>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className='detail-field'>
      <Text className='detail-label'>{label}</Text>
      <Text>{value}</Text>
    </View>
  )
}
