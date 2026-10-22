import { Button, Input, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro, { usePullDownRefresh, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePageDidShow } from '../../services/media-preview'
import {
  completeVaccine,
  getVaccine,
  listVaccines,
  updateVaccinePlan,
} from '../../services/vaccines'
import { useSessionStore } from '../../stores/session'
import type { Vaccine, VaccinePaymentType } from '../../types/vaccine'
import { localDate } from '../../utils/home'
import { validDate } from '../../utils/care-records'
import {
  vaccineError,
  vaccinePayment,
  vaccineSeries,
  vaccineStatus,
} from '../../utils/vaccine-detail'
import './index.scss'

type Sheet = 'edit' | 'complete' | 'series'
export default function VaccineDetail() {
  const { params } = useRouter()
  const { familyId, childId, initialized, currentRole } = useSessionStore()
  const [selectedId, setSelectedId] = useState(params.id)
  const [vaccine, setVaccine] = useState<Vaccine>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<Sheet>()
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [date, setDate] = useState(localDate())
  const [institution, setInstitution] = useState('')
  const [payment, setPayment] = useState<VaccinePaymentType>('free')
  const [paidNote, setPaidNote] = useState('')
  const [note, setNote] = useState('')
  const [series, setSeries] = useState<Vaccine[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [seriesError, setSeriesError] = useState(false)
  const shown = useRef(false)
  const sequence = useRef(0)
  const seriesSequence = useRef(0)
  const scope = `${familyId}|${childId}|${selectedId}`
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const canEdit = currentRole === 'owner' || currentRole === 'adult'
  const today = localDate()
  const load = useCallback(async () => {
    const request = ++sequence.current
    if (!initialized) return
    setSheet(undefined)
    setVaccine(undefined)
    setLoading(true)
    setError('')
    try {
      if (!familyId || !childId || !selectedId) throw new Error('INVALID_VACCINE')
      const data = await getVaccine({ familyId, childId, vaccineId: selectedId })
      if (request === sequence.current) setVaccine(data)
    } catch (cause) {
      console.error('加载疫苗详情失败', cause)
      if (request === sequence.current) setError('无法加载此疫苗，可能已删除或暂无查看权限。')
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [initialized, familyId, childId, selectedId])
  useEffect(() => {
    setSheet(undefined)
    setSaving(false)
    seriesSequence.current += 1
    void load()
    return () => {
      sequence.current += 1
      seriesSequence.current += 1
      scopeRef.current = ''
    }
  }, [load])
  usePageDidShow(() => {
    if (shown.current) void load()
    shown.current = true
  })
  usePullDownRefresh(async () => {
    try {
      if (!saving) await load()
    } finally {
      Taro.stopPullDownRefresh()
    }
  })
  const closeSheet = () => {
    if (!saving) {
      seriesSequence.current += 1
      setSheet(undefined)
    }
  }
  const openForm = (kind: 'edit' | 'complete') => {
    if (!vaccine || !canEdit || vaccine.status !== 'planned' || saving) return
    setDate(kind === 'edit' ? vaccine.plannedDate : today)
    setInstitution(vaccine.institution || '')
    setPayment(vaccine.paymentType || 'free')
    setPaidNote(vaccine.selfPaidVaccineNote || '')
    setNote('')
    setFormError('')
    setSheet(kind)
  }
  const loadSeries = async () => {
    if (!familyId || !childId || !vaccine) return
    const request = ++seriesSequence.current
    setSeriesLoading(true)
    setSeriesError(false)
    setSeries([])
    try {
      const records = await listVaccines({ familyId, childId })
      if (request === seriesSequence.current) setSeries(vaccineSeries(records, vaccine))
    } catch (cause) {
      console.error('加载疫苗剂次失败', cause)
      if (request === seriesSequence.current) setSeriesError(true)
    } finally {
      if (request === seriesSequence.current) setSeriesLoading(false)
    }
  }
  const openSeries = () => {
    setSheet('series')
    void loadSeries()
  }
  const save = async () => {
    if (
      !familyId ||
      !vaccine ||
      !canEdit ||
      saving ||
      vaccine.status !== 'planned' ||
      (sheet !== 'edit' && sheet !== 'complete')
    )
      return
    if (!validDate(date) || (sheet === 'complete' && date > today)) {
      setFormError(
        sheet === 'complete' ? '请选择有效且不晚于今天的实际接种日期。' : '请选择有效的计划日期。',
      )
      return
    }
    const operationScope = scope
    const kind = sheet
    setSaving(true)
    setFormError('')
    try {
      if (kind === 'edit')
        await updateVaccinePlan({
          familyId,
          vaccineId: vaccine.id,
          data: {
            plannedDate: date,
            institution: institution.trim(),
            paymentType: payment,
            selfPaidVaccineNote: payment === 'self_paid' ? paidNote.trim() : '',
          },
        })
      else
        await completeVaccine({
          familyId,
          vaccineId: vaccine.id,
          completedDate: date,
          institution: institution.trim(),
          note: note.trim(),
        })
      if (scopeRef.current !== operationScope) return
      setSheet(undefined)
      Taro.showToast({ title: kind === 'edit' ? '计划已更新' : '已记录接种', icon: 'success' })
      await load()
    } catch (cause) {
      console.error('保存疫苗信息失败', cause)
      if (scopeRef.current === operationScope) setFormError(vaccineError(cause))
    } finally {
      if (scopeRef.current === operationScope) setSaving(false)
    }
  }
  const openAllPlans = () => Taro.navigateTo({ url: '/pages/vaccine/index' })
  const status = vaccine ? vaccineStatus(vaccine, today) : undefined
  return (
    <View className='vaccine-detail-page'>
      {loading ? (
        <View className='vd-state'>正在加载疫苗详情…</View>
      ) : error || !vaccine ? (
        <View className='vd-state'>
          <Text className='vd-state-title'>暂时没能找到这份计划</Text>
          <Text>{error || '请返回疫苗计划重试。'}</Text>
          <Button className='vd-primary' onClick={load}>
            重新加载
          </Button>
        </View>
      ) : (
        <>
          <View className='vd-eyebrow'>
            <Text>宝宝的健康小档案</Text>
            <Text className={`vd-status vd-status-${status?.tone}`}>{status?.label}</Text>
          </View>
          <Text className='vd-title'>{vaccine.name}</Text>
          <Text className='vd-subtitle'>
            第 {vaccine.doseNumber || 1} 针
            {vaccine.totalDoses ? ` / 共 ${vaccine.totalDoses} 针` : ''} · {vaccinePayment(vaccine)}
          </Text>
          <View className='vd-date-focus'>
            <Text className='vd-caption'>
              {vaccine.status === 'completed' ? '实际接种日期' : '计划接种日期'}
            </Text>
            <Text className='vd-date'>
              {(vaccine.status === 'completed'
                ? vaccine.completedDate || '未填写'
                : vaccine.plannedDate
              ).replace(/-/g, '.')}
            </Text>
            <Text className={vaccine.status === 'planned' ? 'vd-relative' : 'vd-caption'}>
              {status?.caption}
            </Text>
          </View>
          <Text className='vd-section-title'>接种信息</Text>
          <View className='vd-fields'>
            <Field label='接种机构' value={vaccine.institution || '未填写'} />
            {vaccine.status === 'completed' && (
              <Field label='原计划日期' value={vaccine.plannedDate} />
            )}
            <Field label='费用类型' value={vaccinePayment(vaccine)} />
            {vaccine.paymentType === 'self_paid' && vaccine.selfPaidVaccineNote && (
              <Field label='自费说明' value={vaccine.selfPaidVaccineNote} />
            )}
            {vaccine.status === 'planned' && (
              <Field
                label='计划提醒'
                value={
                  vaccine.reminderEnabled ? `提前 ${vaccine.reminderDaysBefore ?? 7} 天` : '未开启'
                }
              />
            )}
          </View>
          {vaccine.note?.trim() && (
            <>
              <Text className='vd-section-title'>计划备注</Text>
              <View className='vd-note'>{vaccine.note}</View>
            </>
          )}
          {vaccine.status === 'completed' && vaccine.completedNote?.trim() && (
            <>
              <Text className='vd-section-title'>接种备注</Text>
              <View className='vd-note'>{vaccine.completedNote}</View>
            </>
          )}
          <Button className='vd-link' onClick={openSeries}>
            <Text>查看本疫苗各剂次</Text>
            <Text>›</Text>
          </Button>
          <Button className='vd-link' onClick={openAllPlans}>
            <Text>查看全部疫苗计划</Text>
            <Text>›</Text>
          </Button>
          <View className='vd-dock'>
            {!canEdit && (
              <Text className='vd-readonly'>
                {currentRole === 'viewer'
                  ? '当前为只读成员，可查看接种计划'
                  : '尚未获取家庭权限，暂不可修改'}
              </Text>
            )}
            {canEdit && vaccine.status === 'planned' ? (
              <View className='vd-actions'>
                <Button className='vd-secondary' onClick={() => openForm('edit')}>
                  调整计划
                </Button>
                <Button className='vd-primary' onClick={() => openForm('complete')}>
                  记录已接种
                </Button>
              </View>
            ) : (
              <Button className='vd-primary' onClick={openAllPlans}>
                查看全部疫苗计划
              </Button>
            )}
          </View>
        </>
      )}
      {sheet && vaccine && (
        <View className='vd-mask' onClick={closeSheet}>
          <View className='vd-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='vd-sheet-header'>
              <Text>
                {sheet === 'series'
                  ? '本疫苗各剂次'
                  : sheet === 'edit'
                    ? '调整接种计划'
                    : '记录已接种'}
              </Text>
              <Button disabled={saving} onClick={closeSheet}>
                关闭
              </Button>
            </View>
            <Text className='vd-sheet-subtitle'>
              {vaccine.name}
              {sheet === 'series' ? '' : ` · 第 ${vaccine.doseNumber || 1} 针`}
            </Text>
            <ScrollView scrollY className='vd-sheet-body'>
              {sheet === 'series' ? (
                <>
                  {seriesLoading ? (
                    <View className='vd-state'>正在加载剂次…</View>
                  ) : seriesError ? (
                    <Button className='vd-retry' onClick={loadSeries}>
                      剂次加载失败，点击重试
                    </Button>
                  ) : (
                    series.map((item) => (
                      <Button
                        className={`vd-dose ${item.id === vaccine.id ? 'active' : ''}`}
                        key={item.id}
                        onClick={() => {
                          setSheet(undefined)
                          setSelectedId(item.id)
                          Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
                        }}
                      >
                        <View>
                          <Text>
                            第 {item.doseNumber || 1} 针
                            {item.id === vaccine.id ? ' · 当前查看' : ''}
                          </Text>
                          <Text className='vd-caption'>
                            {item.status === 'completed'
                              ? item.completedDate || '日期未填写'
                              : item.plannedDate}{' '}
                            · {vaccineStatus(item).label}
                          </Text>
                        </View>
                        <Text>›</Text>
                      </Button>
                    ))
                  )}
                </>
              ) : (
                <>
                  <Text className='vd-label'>
                    {sheet === 'edit' ? '计划接种日期' : '实际接种日期'}
                  </Text>
                  <Picker
                    disabled={saving}
                    mode='date'
                    value={date}
                    end={sheet === 'complete' ? today : undefined}
                    onChange={(event) => setDate(event.detail.value)}
                  >
                    <View className='vd-input'>{date}</View>
                  </Picker>
                  <Text className='vd-label'>接种机构（选填）</Text>
                  <Input
                    disabled={saving}
                    className='vd-input'
                    maxlength={80}
                    value={institution}
                    onInput={(event) => setInstitution(event.detail.value)}
                  />
                  {sheet === 'edit' ? (
                    <>
                      <Text className='vd-label'>费用类型</Text>
                      <View className='vd-payment-options'>
                        {(['free', 'self_paid'] as const).map((type) => (
                          <Button
                            disabled={saving}
                            className={`vd-payment ${payment === type ? 'active' : ''}`}
                            key={type}
                            onClick={() => setPayment(type)}
                          >
                            {type === 'free' ? '免费' : '自费'}
                          </Button>
                        ))}
                      </View>
                      {payment === 'self_paid' && (
                        <>
                          <Text className='vd-label'>自费说明（选填）</Text>
                          <Input
                            disabled={saving}
                            className='vd-input'
                            value={paidNote}
                            maxlength={50}
                            onInput={(event) => setPaidNote(event.detail.value)}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <Text className='vd-label'>接种备注（选填）</Text>
                      <Textarea
                        disabled={saving}
                        className='vd-textarea'
                        maxlength={500}
                        value={note}
                        placeholder='按实际接种情况补充记录'
                        onInput={(event) => setNote(event.detail.value)}
                      />
                    </>
                  )}
                  {formError && <Text className='vd-error'>{formError}</Text>}
                </>
              )}
            </ScrollView>
            {sheet !== 'series' && (
              <View className='vd-actions vd-sheet-actions'>
                <Button className='vd-secondary' disabled={saving} onClick={closeSheet}>
                  取消
                </Button>
                <Button
                  className='vd-primary'
                  loading={saving}
                  disabled={saving || !canEdit}
                  onClick={save}
                >
                  {sheet === 'edit' ? '保存计划' : '确认已接种'}
                </Button>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className='vd-field'>
      <Text className='vd-field-label'>{label}</Text>
      <Text className='vd-field-value'>{value}</Text>
    </View>
  )
}
