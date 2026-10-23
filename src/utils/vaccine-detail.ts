import type { Vaccine } from '../types/vaccine'
import { localDate } from './home'

export function vaccineStatus(vaccine: Vaccine, today = localDate()) {
  if (vaccine.status === 'completed')
    return { label: '已接种', tone: 'completed', caption: '这一次守护，已经记好。' }
  if (vaccine.status === 'skipped')
    return { label: '已跳过', tone: 'skipped', caption: '此剂次已跳过，不计入已接种。' }
  const days = Math.round(
    (new Date(`${vaccine.plannedDate}T00:00:00+08:00`).getTime() -
      new Date(`${today}T00:00:00+08:00`).getTime()) /
      86400000,
  )
  if (!Number.isFinite(days)) return { label: '待接种', tone: 'planned', caption: '计划日期待确认' }
  return days < 0
    ? { label: '计划已逾期', tone: 'overdue', caption: `已超过计划日期 ${Math.abs(days)} 天` }
    : days === 0
      ? { label: '今天接种', tone: 'planned', caption: '今天是计划接种日' }
      : { label: '待接种', tone: 'planned', caption: `距离计划日期还有 ${days} 天` }
}
export function vaccinePayment(vaccine: Vaccine) {
  return vaccine.paymentType === 'self_paid'
    ? '自费'
    : vaccine.paymentType === 'free'
      ? '免费'
      : '费用未填写'
}
export function vaccineSeries(records: Vaccine[], selected: Vaccine) {
  const matches = records.filter(
    (vaccine) =>
      vaccine.familyId === selected.familyId &&
      vaccine.childId === selected.childId &&
      (vaccine.id === selected.id ||
        (selected.seriesId
          ? vaccine.seriesId === selected.seriesId
          : selected.catalogId
            ? vaccine.catalogId === selected.catalogId
            : false)),
  )
  return [...matches.filter((vaccine) => vaccine.id !== selected.id), selected].sort(
    (a, b) =>
      (a.doseNumber || 1) - (b.doseNumber || 1) || a.plannedDate.localeCompare(b.plannedDate),
  )
}
export function vaccineError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('CONFLICT')) return '记录已变化，请刷新后重试'
  if (message.includes('FORBIDDEN')) return '仅管理员或记录本人可以修改，请同步家庭权限'
  if (message.includes('COMPLETION_DATE_IMMUTABLE'))
    return '接种日期需通过删除后重新记录更正，避免影响剂次顺序'
  if (message.includes('PREVIOUS_DOSE_NOT_COMPLETED')) return '请先完成前序剂次的接种记录'
  if (message.includes('INTERVAL_INVALID')) return '计划日期不符合剂次间隔要求，请核对日期'
  if (message.includes('COMPLETED_DATE_INVALID')) return '实际接种日期不能早于上一针接种日期'
  if (message.includes('DATE_INVALID')) return '计划日期不能晚于下一针计划日期'
  if (message.includes('IMMUTABLE') || message.includes('NOT_COMPLETABLE'))
    return '当前接种状态已变化，请关闭弹窗并刷新详情'
  if (message.includes('LATER_DOSES_EXIST')) return '后续剂次已有接种记录，不能删除此接种记录'
  return '操作失败，请检查信息后重试'
}
