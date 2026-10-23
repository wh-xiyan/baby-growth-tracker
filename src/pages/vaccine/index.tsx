import { Button, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { usePageDidShow } from '../../services/media-preview'
import { PageLoading } from '../../components/page-loading'
import { Icon } from '../../components/icon'
import { useSessionStore } from '../../stores/session'
import {
  completeVaccine,
  consumeVaccineUpdate,
  createVaccineSeries,
  deleteVaccinePlan,
  listVaccineCatalog,
  listVaccines,
  updateVaccinePlan,
} from '../../services/vaccines'
import type { Vaccine, VaccineCatalogItem, VaccinePaymentType } from '../../types/vaccine'
import { FamilyIdentity } from '../../components/FamilyIdentity'
import { canManage } from '../../domain/family'
import './index.scss'

const todayKey = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

const doseDatesOf = (catalog: VaccineCatalogItem, totalDoses: number, startDate = todayKey()) => {
  let date = startDate
  return Array.from({ length: totalDoses }, (_, index) => {
    if (index) date = addDays(date, Number(catalog.doseIntervals?.[index] || 0))
    return date
  })
}

const statusLabel: Record<Vaccine['status'], string> = {
  planned: '待接种',
  completed: '已接种',
  skipped: '已跳过',
}

export default function Vaccine() {
  const familyId = useSessionStore((state) => state.familyId)
  const childId = useSessionStore((state) => state.childId)
  const initialized = useSessionStore((state) => state.initialized)
  const currentRole = useSessionStore((state) => state.currentRole)
  const [vaccines, setVaccines] = useState<Vaccine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [catalogKeyword, setCatalogKeyword] = useState('')
  const [catalog, setCatalog] = useState<VaccineCatalogItem[]>([])
  const [catalogPickerVisible, setCatalogPickerVisible] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(false)
  const [selectedCatalog, setSelectedCatalog] = useState<VaccineCatalogItem>()
  const [totalDoses, setTotalDoses] = useState(1)
  const [doseDates, setDoseDates] = useState<string[]>([todayKey()])
  const [paymentType, setPaymentType] = useState<VaccinePaymentType>('free')
  const [selfPaidVaccineNote, setSelfPaidVaccineNote] = useState('')
  const [institution, setInstitution] = useState('')
  const [creating, setCreating] = useState(false)
  const [completingId, setCompletingId] = useState<string>()
  const [deletingId, setDeletingId] = useState<string>()
  const [editingVaccine, setEditingVaccine] = useState<Vaccine>()
  const [editPlannedDate, setEditPlannedDate] = useState(todayKey())
  const [editPaymentType, setEditPaymentType] = useState<VaccinePaymentType>('free')
  const [editSelfPaidNote, setEditSelfPaidNote] = useState('')
  const [editInstitution, setEditInstitution] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const loadVaccines = useCallback(async () => {
    if (!initialized) return
    if (!familyId || !childId) {
      setVaccines([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      setVaccines(await listVaccines({ familyId, childId }))
    } catch (reason) {
      console.error('加载疫苗计划失败', reason)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [childId, familyId, initialized])

  useEffect(() => {
    loadVaccines()
  }, [loadVaccines])

  const loadCatalog = async (keyword: string) => {
    setCatalogLoading(true)
    setCatalogError(false)
    try {
      setCatalog(await listVaccineCatalog(keyword))
    } catch (reason) {
      console.error('查询疫苗目录失败', reason)
      setCatalog([])
      setCatalogError(true)
    } finally {
      setCatalogLoading(false)
    }
  }

  const openCatalogPicker = () => {
    setCatalogPickerVisible(true)
    void loadCatalog(catalogKeyword)
  }

  const searchCatalog = (keyword: string) => {
    setCatalogKeyword(keyword)
    void loadCatalog(keyword)
  }

  const selectCatalog = (item: VaccineCatalogItem) => {
    setSelectedCatalog(item)
    const doses = item.defaultDoses || item.minDoses || 1
    setTotalDoses(doses)
    setDoseDates(doseDatesOf(item, doses))
    setCatalogKeyword('')
    setCatalogPickerVisible(false)
  }

  const updateTotalDoses = (value: string) => {
    if (!selectedCatalog) return
    const requested = Number(value)
    const minimum = selectedCatalog.minDoses || selectedCatalog.defaultDoses || 1
    const maximum = selectedCatalog.maxDoses || selectedCatalog.defaultDoses || minimum
    const safeTotal = Math.max(
      minimum,
      Math.min(maximum, Number.isInteger(requested) ? requested : minimum),
    )
    setTotalDoses(safeTotal)
    setDoseDates(doseDatesOf(selectedCatalog, safeTotal, doseDates[0] || todayKey()))
  }

  const updateDoseDate = (index: number, date: string) => {
    setDoseDates((dates) => dates.map((item, itemIndex) => (itemIndex === index ? date : item)))
  }

  const resetCreateForm = () => {
    setCatalogKeyword('')
    setCatalog([])
    setCatalogPickerVisible(false)
    setCatalogError(false)
    setSelectedCatalog(undefined)
    setTotalDoses(1)
    setDoseDates([todayKey()])
    setPaymentType('free')
    setSelfPaidVaccineNote('')
    setInstitution('')
  }

  const closeCreateForm = () => {
    if (creating) return
    resetCreateForm()
    setFormVisible(false)
  }

  usePageDidShow(() => {
    if (consumeVaccineUpdate()) loadVaccines()
  })

  usePullDownRefresh(async () => {
    try {
      await loadVaccines()
    } finally {
      Taro.stopPullDownRefresh()
    }
  })

  const addVaccineSeries = async () => {
    if (!familyId || !childId || !selectedCatalog) {
      Taro.showToast({ title: '请选择疫苗', icon: 'none' })
      return
    }
    if (
      doseDates.length !== totalDoses ||
      doseDates.some((date, index) => index && date < doseDates[index - 1])
    ) {
      Taro.showToast({ title: '请按剂次顺序设置计划时间', icon: 'none' })
      return
    }
    setCreating(true)
    try {
      await createVaccineSeries({
        familyId,
        childId,
        catalogId: selectedCatalog.id,
        totalDoses,
        doses: doseDates.map((plannedDate, index) => ({
          doseNumber: index + 1,
          plannedDate,
          institution: institution.trim() || undefined,
          paymentType,
          selfPaidVaccineNote:
            paymentType === 'self_paid' ? selfPaidVaccineNote.trim() || undefined : undefined,
        })),
      })
      resetCreateForm()
      setFormVisible(false)
      Taro.showToast({ title: '疫苗系列已添加', icon: 'success' })
      await loadVaccines()
    } catch (reason) {
      console.error('创建疫苗计划失败', reason)
      Taro.showToast({ title: '添加失败，请重试', icon: 'none' })
    } finally {
      setCreating(false)
    }
  }

  const markCompleted = async (vaccine: Vaccine) => {
    if (!familyId || currentRole === 'viewer') return
    const previousDose = vaccines
      .filter(
        (item) =>
          item.catalogId === vaccine.catalogId &&
          Number(item.doseNumber) < Number(vaccine.doseNumber) &&
          item.status !== 'completed',
      )
      .sort((left, right) => Number(left.doseNumber) - Number(right.doseNumber))[0]
    if (previousDose) {
      Taro.showToast({ title: `请先完成第 ${previousDose.doseNumber} 针接种`, icon: 'none' })
      return
    }
    const confirmed = await Taro.showModal({
      title: '标记已接种',
      content: `确认已完成“${vaccine.name}${vaccine.doseNumber ? ` 第 ${vaccine.doseNumber} 针` : ''}”吗？`,
      confirmText: '确认完成',
      confirmColor: '#7FA68A',
    })
    if (!confirmed.confirm) return
    setCompletingId(vaccine.id)
    try {
      await completeVaccine({ familyId, vaccineId: vaccine.id, completedDate: todayKey() })
      Taro.showToast({ title: '已标记接种', icon: 'success' })
      await loadVaccines()
    } catch (reason) {
      console.error('完成疫苗接种失败', reason)
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' })
    } finally {
      setCompletingId(undefined)
    }
  }

  const canEdit = ['owner', 'admin', 'adult'].includes(currentRole || '')
  const openEdit = (vaccine: Vaccine) => {
    if (
      vaccine.status !== 'planned' ||
      !canManage(currentRole, useSessionStore.getState().userId, vaccine.createdBy)
    )
      return
    setEditingVaccine(vaccine)
    setEditPlannedDate(vaccine.plannedDate.slice(0, 10))
    setEditPaymentType(vaccine.paymentType || 'free')
    setEditSelfPaidNote(vaccine.selfPaidVaccineNote || '')
    setEditInstitution(vaccine.institution || '')
  }

  const saveEdit = async () => {
    if (!familyId || !editingVaccine) return
    setSavingEdit(true)
    try {
      await updateVaccinePlan({
        familyId,
        vaccineId: editingVaccine.id,
        data: {
          plannedDate: editPlannedDate,
          paymentType: editPaymentType,
          selfPaidVaccineNote: editPaymentType === 'self_paid' ? editSelfPaidNote : undefined,
          institution: editInstitution,
        },
      })
      setEditingVaccine(undefined)
      Taro.showToast({ title: '计划已更新', icon: 'success' })
      await loadVaccines()
    } catch (reason) {
      console.error('更新疫苗计划失败', reason)
      Taro.showToast({ title: '更新失败，请检查接种日期', icon: 'none' })
    } finally {
      setSavingEdit(false)
    }
  }

  const deletePlan = async (vaccine: Vaccine, force = false) => {
    if (!familyId) return
    setDeletingId(vaccine.id)
    try {
      await deleteVaccinePlan({ familyId, vaccineId: vaccine.id, force })
      Taro.showToast({ title: '计划已删除', icon: 'success' })
      await loadVaccines()
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes('LATER_DOSES_EXIST')) {
        const confirmed = await Taro.showModal({
          title: '确认删除此针计划？',
          content: `后续仍有未接种的第 ${Number(vaccine.doseNumber) + 1} 针及后续计划。删除后接种顺序会不完整。`,
          confirmText: '仍要删除',
          confirmColor: '#D96B54',
        })
        if (confirmed.confirm) await deletePlan(vaccine, true)
        return
      }
      console.error('删除疫苗计划失败', reason)
      Taro.showToast({ title: '已接种计划不可删除', icon: 'none' })
    } finally {
      setDeletingId(undefined)
    }
  }
  const requestDeletePlan = async (vaccine: Vaccine) => {
    if (!familyId || deletingId) return
    const hasLaterPlannedDose = vaccines.some(
      (item) =>
        item.catalogId === vaccine.catalogId &&
        Number(item.doseNumber) > Number(vaccine.doseNumber) &&
        item.status === 'planned',
    )
    const confirmed = await Taro.showModal({
      title: hasLaterPlannedDose ? '确认删除此针计划？' : '删除疫苗计划？',
      content: hasLaterPlannedDose
        ? `后续仍有未接种的第 ${Number(vaccine.doseNumber) + 1} 针及后续计划。删除后接种顺序会不完整。`
        : '删除后无法恢复，确认删除吗？',
      confirmText: hasLaterPlannedDose ? '仍要删除' : '删除',
      confirmColor: '#D96B54',
    })
    if (confirmed.confirm) await deletePlan(vaccine, hasLaterPlannedDose)
  }
  const showVaccineNote = (note: string) => {
    void Taro.showModal({
      title: '自费备注',
      content: note,
      showCancel: false,
      confirmText: '知道了',
    })
  }
  const renderVaccineCard = (vaccine: Vaccine) => (
    <View className='vaccine-card'>
      <View className='vaccine-card-title-row'>
        <View className={`vaccine-card-icon vaccine-card-icon-${vaccine.status}`}>
          <Icon name='needle' size={17} />
        </View>
        <Text
          className='vaccine-card-title'
          onClick={() =>
            Taro.navigateTo({
              url: `/pages/vaccine-detail/index?id=${encodeURIComponent(vaccine.id)}`,
            })
          }
        >
          {vaccine.name} ›
        </Text>
        {canEdit &&
        canManage(currentRole, useSessionStore.getState().userId, vaccine.createdBy) &&
        vaccine.status === 'planned' ? (
          <Button
            className='vaccine-complete vaccine-complete-planned'
            loading={completingId === vaccine.id}
            onClick={() => markCompleted(vaccine)}
          >
            待接种
          </Button>
        ) : (
          <Text className={`vaccine-card-status vaccine-card-status-${vaccine.status}`}>
            {statusLabel[vaccine.status]}
          </Text>
        )}
      </View>
      <View className='vaccine-card-content'>
        <View className='vaccine-card-meta'>
          <Text className='vaccine-dose-label'>＃ 第{vaccine.doseNumber || 1}针</Text>
          <View className='vaccine-meta-item'>
            <Icon name='plan' size={24} />
            <Text>{vaccine.plannedDate.slice(0, 10)}</Text>
          </View>
          <Text className={`vaccine-payment-tag vaccine-payment-${vaccine.paymentType || 'free'}`}>
            {vaccine.paymentType === 'self_paid' ? '自费' : '免费'}
          </Text>
        </View>
        {vaccine.status === 'completed' && vaccine.completedDate && (
          <View className='vaccine-card-actual'>
            <Icon name='calendar' size={24} />
            <Text>已接种时间：{vaccine.completedDate.slice(0, 10)}</Text>
          </View>
        )}
        {vaccine.paymentType === 'self_paid' && vaccine.selfPaidVaccineNote && (
          <Text
            className='vaccine-card-note'
            onClick={() => showVaccineNote(vaccine.selfPaidVaccineNote || '')}
          >
            备注：{vaccine.selfPaidVaccineNote}
          </Text>
        )}
      </View>
    </View>
  )
  return (
    <View className='vaccine-page'>
      <FamilyIdentity />
      <PageLoading visible={loading} />
      <View className='vaccine-header'>
        <View className='vaccine-eyebrow'>HEALTH & CARE</View>
        <View className='vaccine-title'>疫苗计划</View>
        <View className='vaccine-subtitle'>把每一次守护都记得清清楚楚</View>
      </View>

      {canEdit && (
        <Button
          className='vaccine-add-trigger'
          onClick={() => {
            resetCreateForm()
            setFormVisible(true)
          }}
        >
          ＋ 添加疫苗计划
        </Button>
      )}

      {formVisible && (
        <View className='vaccine-sheet-mask' onClick={closeCreateForm}>
          <View className='vaccine-form vaccine-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='vaccine-sheet-header'>
              <Text className='vaccine-sheet-title'>添加疫苗计划</Text>
              <Button className='vaccine-sheet-close' onClick={closeCreateForm}>
                ×
              </Button>
            </View>
            <View className='vaccine-field-label'>选择疫苗</View>
            <Button className='vaccine-catalog-trigger' onClick={openCatalogPicker}>
              <Text className={selectedCatalog ? '' : 'vaccine-catalog-placeholder'}>
                {selectedCatalog ? selectedCatalog.name : '点击选择疫苗'}
              </Text>
              <Text className='vaccine-catalog-arrow'>⌄</Text>
            </Button>
            {catalogPickerVisible && (
              <View className='catalog-picker'>
                <Input
                  className='vaccine-input catalog-search-input'
                  placeholder='搜索疫苗名称，例如：百白破、流感'
                  value={catalogKeyword}
                  onInput={(event) => searchCatalog(event.detail.value)}
                />
                {catalogLoading && <View className='catalog-state'>正在查询疫苗目录...</View>}
                {!catalogLoading && catalogError && (
                  <View className='catalog-state'>疫苗目录加载失败</View>
                )}
                {!catalogLoading && !catalogError && (
                  <ScrollView className='catalog-list' scrollY>
                    {catalog.map((item) => (
                      <Button
                        className={`catalog-option ${selectedCatalog?.id === item.id ? 'active' : ''}`}
                        key={item.id}
                        onClick={() => selectCatalog(item)}
                      >
                        <Text>{item.name}</Text>
                        <Text>{item.category === 'national' ? '免疫规划' : '非免疫规划'}</Text>
                      </Button>
                    ))}
                    {!catalog.length && <View className='catalog-state'>未找到匹配的疫苗</View>}
                  </ScrollView>
                )}
              </View>
            )}
            {selectedCatalog && (
              <>
                <View className='vaccine-field-label'>接种计划</View>
                <View className='vaccine-form-row'>
                  <Input
                    className='vaccine-input vaccine-dose-input'
                    type='number'
                    value={String(totalDoses)}
                    onInput={(event) => updateTotalDoses(event.detail.value)}
                  />
                  <View className='vaccine-dose-hint'>共 {totalDoses} 针，请逐针确认计划时间</View>
                </View>
                <View className='vaccine-dose-plan-list'>
                  {doseDates.map((date, index) => (
                    <View className='vaccine-dose-plan' key={index}>
                      <Text>第 {index + 1} 针</Text>
                      <Picker
                        mode='date'
                        value={date}
                        onChange={(event) => updateDoseDate(index, event.detail.value)}
                      >
                        <View className='vaccine-date-picker'>{date}</View>
                      </Picker>
                    </View>
                  ))}
                </View>
              </>
            )}
            <View className='vaccine-field-label'>是否自费</View>
            <View className='payment-options'>
              <Button
                className={`payment-option ${paymentType === 'free' ? 'active' : ''}`}
                onClick={() => setPaymentType('free')}
              >
                免费
              </Button>
              <Button
                className={`payment-option ${paymentType === 'self_paid' ? 'active' : ''}`}
                onClick={() => setPaymentType('self_paid')}
              >
                自费
              </Button>
            </View>
            {paymentType === 'self_paid' && (
              <View className='vaccine-note-field'>
                <Input
                  className='vaccine-input'
                  maxlength={50}
                  placeholder='填写自费疫苗种类或产品说明（选填）'
                  value={selfPaidVaccineNote}
                  onInput={(event) => setSelfPaidVaccineNote(event.detail.value.slice(0, 50))}
                />
                <Text className='vaccine-note-count'>{selfPaidVaccineNote.length}/50</Text>
              </View>
            )}
            <Input
              className='vaccine-input'
              maxlength={80}
              placeholder='接种机构（选填）'
              value={institution}
              onInput={(event) => setInstitution(event.detail.value)}
            />
            <Button
              className='vaccine-submit'
              loading={creating}
              disabled={creating}
              onClick={addVaccineSeries}
            >
              保存计划
            </Button>
          </View>
        </View>
      )}

      {editingVaccine && (
        <View
          className='vaccine-sheet-mask'
          onClick={() => !savingEdit && setEditingVaccine(undefined)}
        >
          <View className='vaccine-form vaccine-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='vaccine-sheet-header'>
              <Text className='vaccine-sheet-title'>编辑第 {editingVaccine.doseNumber} 针计划</Text>
              <Button
                className='vaccine-sheet-close'
                onClick={() => !savingEdit && setEditingVaccine(undefined)}
              >
                ×
              </Button>
            </View>
            <View className='vaccine-edit-name'>{editingVaccine.name}</View>
            <View className='vaccine-field-label'>计划接种时间</View>
            <Picker
              mode='date'
              value={editPlannedDate}
              onChange={(event) => setEditPlannedDate(event.detail.value)}
            >
              <View className='vaccine-date-picker'>{editPlannedDate}</View>
            </Picker>
            <View className='vaccine-field-label'>是否自费</View>
            <View className='payment-options'>
              <Button
                className={`payment-option ${editPaymentType === 'free' ? 'active' : ''}`}
                onClick={() => setEditPaymentType('free')}
              >
                免费
              </Button>
              <Button
                className={`payment-option ${editPaymentType === 'self_paid' ? 'active' : ''}`}
                onClick={() => setEditPaymentType('self_paid')}
              >
                自费
              </Button>
            </View>
            {editPaymentType === 'self_paid' && (
              <View className='vaccine-note-field'>
                <Input
                  className='vaccine-input'
                  maxlength={50}
                  placeholder='填写自费疫苗种类或产品说明（选填）'
                  value={editSelfPaidNote}
                  onInput={(event) => setEditSelfPaidNote(event.detail.value.slice(0, 50))}
                />
                <Text className='vaccine-note-count'>{editSelfPaidNote.length}/50</Text>
              </View>
            )}
            <Input
              className='vaccine-input'
              maxlength={80}
              placeholder='接种机构（选填）'
              value={editInstitution}
              onInput={(event) => setEditInstitution(event.detail.value)}
            />
            <Button
              className='vaccine-submit'
              loading={savingEdit}
              disabled={savingEdit}
              onClick={saveEdit}
            >
              保存修改
            </Button>
          </View>
        </View>
      )}

      <ScrollView className='vaccine-list-scroll' scrollY>
        {!loading && error && (
          <Button className='vaccine-state vaccine-state-button' onClick={loadVaccines}>
            疫苗计划加载失败，点击重试
          </Button>
        )}
        {!loading && !error && !vaccines.length && (
          <View className='vaccine-state'>暂无疫苗计划</View>
        )}
        {!loading && !error && vaccines.length > 0 && (
          <View className='vaccine-list'>
            {vaccines.map((vaccine) =>
              canEdit &&
              canManage(currentRole, useSessionStore.getState().userId, vaccine.createdBy) &&
              vaccine.status === 'planned' ? (
                <vaccine-swipe-cell
                  key={vaccine.id}
                  onEdit={() => openEdit(vaccine)}
                  onDelete={() => requestDeletePlan(vaccine)}
                >
                  {renderVaccineCard(vaccine)}
                </vaccine-swipe-cell>
              ) : (
                <View className='vaccine-list-card' key={vaccine.id}>
                  {renderVaccineCard(vaccine)}
                </View>
              ),
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
