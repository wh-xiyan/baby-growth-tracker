export type VaccineStatus = 'planned' | 'completed' | 'skipped'
export type ReminderUrgency = 'overdue' | 'today' | 'upcoming'
export type VaccinePaymentType = 'free' | 'self_paid'

export interface Vaccine {
  id: string
  familyId: string
  childId: string
  name: string
  doseNumber?: number
  catalogId?: string
  seriesId?: string
  totalDoses?: number
  plannedDate: string
  paymentType?: VaccinePaymentType
  selfPaidVaccineNote?: string
  completedDate?: string
  status: VaccineStatus
  reminderEnabled: boolean
  reminderDaysBefore?: number
  institution?: string
  note?: string
  completedNote?: string
  createdBy?: string
  completedBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface VaccineCatalogItem {
  id: string
  name: string
  category: 'national' | 'optional'
  active: boolean
  sortOrder: number
  aliases?: string[]
  description?: string
  defaultDoses?: number
  minDoses?: number
  maxDoses?: number
  doseIntervals?: number[]
}

export interface VaccineDosePlan {
  doseNumber: number
  plannedDate: string
  paymentType: VaccinePaymentType
  selfPaidVaccineNote?: string
  institution?: string
}

export interface VaccineSeries {
  id: string
  familyId: string
  childId: string
  catalogId: string
  vaccineName: string
  totalDoses: number
  createdAt?: string
  updatedAt?: string
}

export interface HomeReminder {
  id: string
  type: 'vaccination'
  vaccineName: string
  doseNumber?: number
  plannedDate: string
  urgency: ReminderUrgency
  institution?: string
  relativeLabel: string
}
