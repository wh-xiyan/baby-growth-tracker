import type { Child } from '../types/child'
import type { DailyRecord } from '../services/records'
import type { FamilyRole } from '../types/family'
import type { GrowthMetric, GrowthReference, StandardRow } from '../types/growth'
import standard from '../data/growth-standard.json'
import { localDate, isMeasurement } from './home'
import { validDate } from './care-records'

export const growthMetrics: GrowthMetric[] = ['height', 'weight', 'headCircumference']
export const growthLabels = { height: '身长/身高', weight: '体重', headCircumference: '头围' }
export const growthUnits = { height: 'cm', weight: 'kg', headCircumference: 'cm' }
export const measurementMethods: Record<string, string> = {
  lying: '卧位身长',
  standing: '站立身高',
  unknown: '未记录方法',
}
export const growthStandard = standard
export const isGrowthEvent = (r: DailyRecord) =>
  ['milestone', 'study'].includes(r.category) && !isMeasurement(r)
export const canManageRecord = (
  role: FamilyRole | undefined,
  userId: string | undefined,
  record: DailyRecord,
) =>
  role === 'owner' ||
  role === 'admin' ||
  (role === 'adult' && Boolean(userId) && record.createdBy === userId)

/** Calendar month age; month-end anniversaries clamp to the last day of the target month. */
export function growthAge(birthday: string | undefined, date: string) {
  const birth = birthday?.slice(0, 10)
  if (!birth || !validDate(birth) || !validDate(date.slice(0, 10))) return undefined
  const b = new Date(birth + 'T00:00:00Z'),
    d = new Date(date.slice(0, 10) + 'T00:00:00Z')
  if (d < b) return undefined
  const at = (m: number) =>
    new Date(
      Date.UTC(
        b.getUTCFullYear(),
        b.getUTCMonth() + m,
        Math.min(
          b.getUTCDate(),
          new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + m + 1, 0)).getUTCDate(),
        ),
      ),
    )
  let whole = (d.getUTCFullYear() - b.getUTCFullYear()) * 12 + d.getUTCMonth() - b.getUTCMonth()
  if (d < at(whole)) whole--
  return {
    whole,
    exact:
      whole + (d.getTime() - at(whole).getTime()) / (at(whole + 1).getTime() - at(whole).getTime()),
  }
}
export function growthAgeLabel(birthday: string | undefined, date: string) {
  const age = growthAge(birthday, date)
  if (!age) return '年龄待确认'
  return age.whole < 12
    ? `${age.whole}个月`
    : `${Math.floor(age.whole / 12)}岁${age.whole % 12}个月`
}
export function referenceRows(child: Child | undefined, metric: GrowthMetric): StandardRow[] {
  if (!child || (child.gender !== 'male' && child.gender !== 'female')) return []
  return standard.data[child.gender][metric] as StandardRow[]
}
export function compareGrowth(
  record: DailyRecord,
  child: Child | undefined,
  metric: GrowthMetric,
): GrowthReference {
  if (!child || !growthAge(child.birthday, localDate(record.occurredAt)))
    return { reason: '宝宝出生日期缺失或测量早于出生日期，暂不进行标准对照。' }
  if (child.gender !== 'male' && child.gender !== 'female')
    return { reason: '宝宝档案尚未填写性别，暂不匹配参考表，实测记录照常保留。' }
  const age = growthAge(child.birthday, localDate(record.occurredAt))!
  if (age.exact >= 84) return { reason: '该次测量已满7周岁，超出本标准适用范围，仅展示实测记录。' }
  if (metric === 'headCircumference' && age.exact > 36)
    return { reason: '头围参考表仅覆盖0～3岁，本次测量超出表格范围，仅展示实测记录。' }
  if (
    metric === 'height' &&
    record.metrics?.measurementMethod !== (age.whole < 24 ? 'lying' : 'standing')
  )
    return {
      reason: `此年龄参考表使用${age.whole < 24 ? '卧位身长' : '站立身高'}；本条为${measurementMethods[String(record.metrics?.measurementMethod)] || '未记录方法'}，请核对测量方法，暂不对照。`,
    }
  const row = referenceRows(child, metric).find((item) => item[0] === age.whole)
  if (!row)
    return {
      reason: `标准未列出${age.whole}整月龄的独立数值，不插值计算百分位，也不外推表外数据。`,
    }
  const v = Number(record.metrics?.[metric]),
    p = [3, 10, 25, 50, 75, 90, 97]
  if (!Number.isFinite(v) || v <= 0) return { reason: '缺少有效测量值，暂不进行标准对照。' }
  let position: string
  if (v < row[1]) position = '低于 P3'
  else if (v > row[7]) position = '高于 P97'
  else {
    const same = row.slice(1).findIndex((value) => v === value)
    if (same >= 0) position = `位于 P${p[same]}`
    else {
      const upper = row.slice(1).findIndex((value) => value > v)
      position = `位于 P${p[upper - 1]}—P${p[upper]} 之间`
    }
  }
  return { row, position, month: age.whole, table: standard.tables[child.gender][metric] }
}
export function measurementTitle(r: DailyRecord) {
  return (
    growthMetrics
      .filter((k) => typeof r.metrics?.[k] === 'number')
      .map((k) => `${growthLabels[k]} ${r.metrics![k]}${growthUnits[k]}`)
      .join(' · ') || '身体测量'
  )
}
export function growthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('MEDIA_CLEANUP_PENDING'))
    return '记录已移除，部分媒体清理失败，请再次点击删除重试'
  if (message.includes('CONFLICT'))
    return '记录已被其他成员修改，请返回刷新后再编辑；当前输入已保留'
  if (message.includes('FORBIDDEN')) return '当前没有操作权限，请同步家庭权限后重试'
  if (message.includes('INVALID_GROWTH_DATE')) return '发生时间须在宝宝出生后，且不能晚于现在'
  if (message.includes('INVALID_MEDIA')) return '照片与视频合计最多10个，请检查附件后重试'
  return '操作失败，请检查网络后重试，填写内容已保留'
}
