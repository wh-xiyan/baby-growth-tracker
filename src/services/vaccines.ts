import Taro from '@tarojs/taro'
import { assertFamilyAccess } from './permissions'
import { useSessionStore } from '../stores/session'
import { canManage } from '../domain/family'
import type {
  HomeReminder,
  ReminderUrgency,
  Vaccine,
  VaccineCatalogItem,
  VaccineDosePlan,
  VaccinePaymentType,
} from '../types/vaccine'
import { callCloudFunction, isCloudConfigured } from './cloud'

const DEMO_KEY = 'baby-growth-demo-vaccines'
const UPDATE_KEY = 'baby-growth-vaccines-updated'
const CATALOG: VaccineCatalogItem[] = [
  {
    id: 'hepatitis-b',
    name: '乙型肝炎疫苗',
    category: 'national',
    active: true,
    sortOrder: 10,
    defaultDoses: 3,
  },
  { id: 'bcg', name: '卡介苗', category: 'national', active: true, sortOrder: 20, defaultDoses: 1 },
  {
    id: 'polio-ipv',
    name: '脊髓灰质炎灭活疫苗',
    category: 'national',
    active: true,
    sortOrder: 30,
    defaultDoses: 4,
  },
  {
    id: 'dtap',
    name: '吸附无细胞百白破联合疫苗',
    category: 'national',
    active: true,
    sortOrder: 50,
    defaultDoses: 5,
  },
  {
    id: 'mmr',
    name: '麻疹腮腺炎风疹联合减毒活疫苗',
    category: 'national',
    active: true,
    sortOrder: 80,
    defaultDoses: 1,
  },
  {
    id: 'varicella',
    name: '水痘减毒活疫苗',
    category: 'optional',
    active: true,
    sortOrder: 210,
    defaultDoses: 2,
  },
  {
    id: 'hib',
    name: 'b型流感嗜血杆菌疫苗',
    category: 'optional',
    active: true,
    sortOrder: 220,
    defaultDoses: 3,
  },
  {
    id: 'pneumococcal',
    name: '肺炎球菌结合疫苗',
    category: 'optional',
    active: true,
    sortOrder: 230,
    defaultDoses: 4,
  },
  {
    id: 'influenza',
    name: '流感疫苗',
    category: 'optional',
    active: true,
    sortOrder: 240,
    defaultDoses: 1,
  },
  {
    id: 'rotavirus',
    name: '轮状病毒疫苗',
    category: 'optional',
    active: true,
    sortOrder: 250,
    defaultDoses: 3,
  },
  {
    id: 'ev71',
    name: '肠道病毒71型灭活疫苗',
    category: 'optional',
    active: true,
    sortOrder: 260,
    defaultDoses: 2,
  },
]

const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const dayDistance = (plannedDate: string) => {
  const today = new Date(`${dateKey()}T00:00:00`)
  const planned = new Date(`${plannedDate.slice(0, 10)}T00:00:00`)
  return Math.round((planned.getTime() - today.getTime()) / 86400000)
}

function reminderOf(vaccine: Vaccine): HomeReminder | undefined {
  if (vaccine.status !== 'planned') return undefined
  const distance = dayDistance(vaccine.plannedDate)
  const urgency: ReminderUrgency = distance < 0 ? 'overdue' : distance === 0 ? 'today' : 'upcoming'
  const relativeLabel =
    distance < 0
      ? `已逾期 ${Math.abs(distance)} 天`
      : distance === 0
        ? '今天接种'
        : `还有 ${distance} 天`
  return {
    id: vaccine.id,
    type: 'vaccination',
    vaccineName: vaccine.name,
    institution: vaccine.institution,
    doseNumber: vaccine.doseNumber,
    plannedDate: vaccine.plannedDate,
    urgency,
    relativeLabel,
  }
}

const urgencyOrder: Record<ReminderUrgency, number> = { overdue: 0, today: 1, upcoming: 2 }

function normalizeDate(value: unknown) {
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) return dateKey(value)
  return ''
}

function normalizeVaccine(vaccine: Vaccine): Vaccine {
  return {
    ...vaccine,
    plannedDate: normalizeDate(vaccine.plannedDate),
    completedDate: vaccine.completedDate ? normalizeDate(vaccine.completedDate) : undefined,
  }
}

export function consumeVaccineUpdate() {
  const updated = Boolean(Taro.getStorageSync(UPDATE_KEY))
  if (updated) Taro.removeStorageSync(UPDATE_KEY)
  return updated
}

function markVaccineUpdated() {
  Taro.setStorageSync(UPDATE_KEY, true)
}

export async function listVaccines(input: {
  familyId: string
  childId: string
}): Promise<Vaccine[]> {
  assertFamilyAccess(input.familyId, 'childId' in input ? String(input.childId) : undefined)
  const vaccines = isCloudConfigured()
    ? await callCloudFunction<Vaccine[]>('listVaccines', input)
    : ((Taro.getStorageSync(DEMO_KEY) || []) as Vaccine[])
  return vaccines
    .filter((item) => item.familyId === input.familyId && item.childId === input.childId)
    .map(normalizeVaccine)
    .sort((left, right) => left.plannedDate.localeCompare(right.plannedDate))
}

export async function getVaccine(input: {
  familyId: string
  childId: string
  vaccineId: string
}): Promise<Vaccine> {
  assertFamilyAccess(input.familyId, 'childId' in input ? String(input.childId) : undefined)
  if (isCloudConfigured())
    return normalizeVaccine(await callCloudFunction<Vaccine>('getVaccine', input))
  const vaccines = await listVaccines(input)
  const vaccine = vaccines.find((item) => item.id === input.vaccineId)
  if (!vaccine) throw new Error('VACCINE_NOT_FOUND')
  return vaccine
}

export async function listHomeReminders(input: {
  familyId: string
  childId: string
  limit?: number
}): Promise<HomeReminder[]> {
  assertFamilyAccess(input.familyId, 'childId' in input ? String(input.childId) : undefined)
  if (isCloudConfigured()) return callCloudFunction<HomeReminder[]>('listHomeReminders', input)
  const vaccines = await listVaccines(input)
  return vaccines
    .map(reminderOf)
    .filter((item): item is HomeReminder => Boolean(item))
    .sort(
      (left, right) =>
        urgencyOrder[left.urgency] - urgencyOrder[right.urgency] ||
        left.plannedDate.localeCompare(right.plannedDate),
    )
    .slice(0, input.limit || 3)
}

export async function listVaccineCatalog(keyword = ''): Promise<VaccineCatalogItem[]> {
  if (isCloudConfigured())
    return callCloudFunction<VaccineCatalogItem[]>('listVaccineCatalog', { keyword, limit: 100 })
  const normalizedKeyword = keyword.trim().toLowerCase()
  return CATALOG.filter((item) => item.name.toLowerCase().includes(normalizedKeyword))
}

export async function createVaccine(input: {
  familyId: string
  childId: string
  name: string
  catalogId?: string
  doseNumber?: number
  plannedDate: string
  paymentType?: VaccinePaymentType
  selfPaidVaccineNote?: string
  institution?: string
  reminderEnabled?: boolean
  reminderDaysBefore?: number
  note?: string
}): Promise<{ id: string }> {
  assertFamilyAccess(input.familyId, input.childId, true)
  if (isCloudConfigured()) {
    const created = await callCloudFunction<{ id: string }>('createVaccine', input)
    markVaccineUpdated()
    return created
  }
  const vaccines = (Taro.getStorageSync(DEMO_KEY) || []) as Vaccine[]
  const id = `demo-vaccine-${Date.now()}`
  const now = new Date().toISOString()
  Taro.setStorageSync(DEMO_KEY, [
    ...vaccines,
    {
      ...input,
      id,
      status: 'planned',
      createdBy: useSessionStore.getState().userId,
      reminderEnabled: input.reminderEnabled !== false,
      createdAt: now,
      updatedAt: now,
    },
  ])
  markVaccineUpdated()
  return { id }
}

export async function createVaccineSeries(input: {
  familyId: string
  childId: string
  catalogId: string
  totalDoses: number
  doses: VaccineDosePlan[]
}): Promise<{ seriesId: string; vaccineIds: string[] }> {
  assertFamilyAccess(input.familyId, 'childId' in input ? String(input.childId) : undefined, true)
  if (isCloudConfigured()) {
    const created = await callCloudFunction<{ seriesId: string; vaccineIds: string[] }>(
      'createVaccineSeries',
      input,
    )
    markVaccineUpdated()
    return created
  }
  const catalog = CATALOG.find((item) => item.id === input.catalogId)
  if (!catalog) throw new Error('INVALID_VACCINE_CATALOG')
  const vaccines = (Taro.getStorageSync(DEMO_KEY) || []) as Vaccine[]
  const duplicate = vaccines.some(
    (item) =>
      item.familyId === input.familyId &&
      item.childId === input.childId &&
      item.catalogId === input.catalogId,
  )
  if (duplicate) throw new Error('VACCINE_SERIES_EXISTS')
  const seriesId = `demo-vaccine-series-${Date.now()}`
  const now = new Date().toISOString()
  const created = input.doses.map((dose) => ({
    id: `demo-vaccine-${Date.now()}-${dose.doseNumber}`,
    familyId: input.familyId,
    childId: input.childId,
    catalogId: input.catalogId,
    seriesId,
    totalDoses: input.totalDoses,
    name: catalog.name,
    ...dose,
    status: 'planned' as const,
    reminderEnabled: true,
    createdBy: useSessionStore.getState().userId,
    createdAt: now,
    updatedAt: now,
  }))
  Taro.setStorageSync(DEMO_KEY, [...vaccines, ...created])
  markVaccineUpdated()
  return { seriesId, vaccineIds: created.map((item) => item.id) }
}

export async function updateVaccinePlan(input: {
  familyId: string
  vaccineId: string
  data: {
    plannedDate?: string
    paymentType?: VaccinePaymentType
    selfPaidVaccineNote?: string
    institution?: string
  }
}): Promise<{ id: string }> {
  assertFamilyAccess(input.familyId, 'childId' in input ? String(input.childId) : undefined, true)
  if (isCloudConfigured()) {
    const updated = await callCloudFunction<{ id: string }>('updateVaccine', input)
    markVaccineUpdated()
    return updated
  }
  const vaccines = (Taro.getStorageSync(DEMO_KEY) || []) as Vaccine[]
  const target = vaccines.find((v) => v.id === input.vaccineId && v.familyId === input.familyId)
  if (!target) throw new Error('VACCINE_NOT_FOUND')
  if (
    !canManage(
      useSessionStore.getState().currentRole,
      useSessionStore.getState().userId,
      target.createdBy,
    )
  )
    throw new Error('FORBIDDEN')
  const updated = vaccines.map((vaccine) =>
    vaccine.id === input.vaccineId && vaccine.familyId === input.familyId
      ? { ...vaccine, ...input.data, updatedAt: new Date().toISOString() }
      : vaccine,
  )
  Taro.setStorageSync(DEMO_KEY, updated)
  markVaccineUpdated()
  return { id: input.vaccineId }
}

export async function deleteVaccinePlan(input: {
  familyId: string
  vaccineId: string
  force?: boolean
}): Promise<{ id: string }> {
  assertFamilyAccess(input.familyId, 'childId' in input ? String(input.childId) : undefined, true)
  if (isCloudConfigured()) {
    const deleted = await callCloudFunction<{ id: string }>('deleteVaccine', input)
    markVaccineUpdated()
    return deleted
  }
  const vaccines = (Taro.getStorageSync(DEMO_KEY) || []) as Vaccine[]
  const target = vaccines.find(
    (item) => item.id === input.vaccineId && item.familyId === input.familyId,
  )
  if (!target) throw new Error('VACCINE_NOT_FOUND')
  if (
    !canManage(
      useSessionStore.getState().currentRole,
      useSessionStore.getState().userId,
      target.createdBy,
    )
  )
    throw new Error('FORBIDDEN')
  if (target.status === 'completed') throw new Error('COMPLETED_VACCINE_IMMUTABLE')
  const later = vaccines.some(
    (item) =>
      item.familyId === input.familyId &&
      item.childId === target.childId &&
      item.catalogId === target.catalogId &&
      Number(item.doseNumber) > Number(target.doseNumber) &&
      item.status === 'planned',
  )
  if (later && !input.force) throw new Error('LATER_DOSES_EXIST')
  Taro.setStorageSync(
    DEMO_KEY,
    vaccines.filter((item) => item.id !== input.vaccineId),
  )
  markVaccineUpdated()
  return { id: input.vaccineId }
}

export async function completeVaccine(input: {
  familyId: string
  vaccineId: string
  completedDate: string
  institution?: string
  note?: string
}): Promise<{ id: string }> {
  assertFamilyAccess(input.familyId, 'childId' in input ? String(input.childId) : undefined, true)
  if (isCloudConfigured()) {
    const completed = await callCloudFunction<{ id: string }>('completeVaccine', input)
    markVaccineUpdated()
    return completed
  }
  const vaccines = (Taro.getStorageSync(DEMO_KEY) || []) as Vaccine[]
  const updated = vaccines.map((vaccine) =>
    vaccine.id === input.vaccineId && vaccine.familyId === input.familyId
      ? {
          ...vaccine,
          status: 'completed' as const,
          completionVersion: (vaccine.completionVersion || 0) + 1,
          completedBy: useSessionStore.getState().userId,
          completedDate: input.completedDate,
          institution: input.institution,
          completedNote: input.note,
          updatedAt: new Date().toISOString(),
        }
      : vaccine,
  )
  Taro.setStorageSync(DEMO_KEY, updated)
  markVaccineUpdated()
  return { id: input.vaccineId }
}

export async function manageVaccineCompletion(input: {
  familyId: string
  vaccineId: string
  action: 'update' | 'delete'
  expectedVersion?: number
  completedDate?: string
  institution?: string
  note?: string
}) {
  const session = assertFamilyAccess(input.familyId, undefined, true)
  if (isCloudConfigured()) await callCloudFunction('manageVaccineCompletion', input)
  else {
    const all = (Taro.getStorageSync(DEMO_KEY) || []) as Vaccine[],
      target = all.find((v) => v.id === input.vaccineId && v.familyId === input.familyId)
    if (!target || target.status !== 'completed') throw new Error('NOT_FOUND')
    if ((target.completionVersion || 0) !== input.expectedVersion)
      throw new Error('RECORD_CONFLICT')
    if (!canManage(session.currentRole, session.userId, target.completedBy))
      throw new Error('FORBIDDEN')
    if (input.action === 'delete') {
      if (
        all.some(
          (v) =>
            v.familyId === input.familyId &&
            v.childId === target.childId &&
            v.catalogId === target.catalogId &&
            Number(v.doseNumber) > Number(target.doseNumber) &&
            v.status === 'completed',
        )
      )
        throw new Error('LATER_DOSES_EXIST')
      target.status = 'planned'
      delete target.completedDate
      delete target.completedBy
      delete target.completedNote
    } else {
      const date = new Date(String(input.completedDate))
      if (!Number.isFinite(date.getTime()) || date > new Date())
        throw new Error('INVALID_COMPLETED_DATE')
      if (
        all.some(
          (v) =>
            v.id !== target.id &&
            v.familyId === target.familyId &&
            v.childId === target.childId &&
            v.catalogId === target.catalogId &&
            v.status === 'completed' &&
            ((Number(v.doseNumber) < Number(target.doseNumber) &&
              date < new Date(v.completedDate!)) ||
              (Number(v.doseNumber) > Number(target.doseNumber) &&
                date > new Date(v.completedDate!))),
        )
      )
        throw new Error('VACCINE_COMPLETED_DATE_INVALID')
      target.completedDate = input.completedDate
      target.institution = input.institution
      target.completedNote = input.note
    }
    target.completionVersion = (target.completionVersion || 0) + 1
    target.updatedAt = new Date().toISOString()
    Taro.setStorageSync(DEMO_KEY, all)
  }
  markVaccineUpdated()
}
