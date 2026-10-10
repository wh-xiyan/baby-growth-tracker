import { activeMember, context, db, now, result } from '../../shared/db'

type DoseInput = {
  doseNumber?: unknown
  plannedDate?: unknown
  paymentType?: unknown
  selfPaidVaccineNote?: unknown
  institution?: unknown
}

const dateValue = (value: unknown) => {
  const date = new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_PLANNED_DATE')
  return date
}

const text = (value: unknown, maxLength: number) => {
  const content = String(value || '').trim()
  if (content.length > maxLength) throw new Error('TEXT_TOO_LONG')
  return content
}

export async function main(event: {
  familyId?: string
  childId?: string
  catalogId?: string
  totalDoses?: number
  doses?: DoseInput[]
}) {
  const familyId = String(event?.familyId || '')
  const childId = String(event?.childId || '')
  const catalogId = String(event?.catalogId || '')
  if (!familyId || !childId || !catalogId || !Array.isArray(event?.doses)) {
    throw new Error('INVALID_VACCINE_SERIES')
  }

  const member = await activeMember(familyId, context())
  if (member.role === 'viewer') throw new Error('FORBIDDEN')

  const child = await db.collection('children').where({ _id: childId, familyId }).limit(1).get()
  if (!child.data[0]) throw new Error('CHILD_NOT_FOUND')

  const catalogResult = await db.collection('vaccine_catalog').doc(catalogId).get()
  const catalog = catalogResult.data as Record<string, any> | undefined
  if (!catalog?.active) throw new Error('INVALID_VACCINE_CATALOG')

  const totalDoses = Number(event.totalDoses)
  const minDoses = Number(catalog.minDoses || catalog.defaultDoses || 1)
  const maxDoses = Number(catalog.maxDoses || catalog.defaultDoses || minDoses)
  if (!Number.isInteger(totalDoses) || totalDoses < minDoses || totalDoses > maxDoses) {
    throw new Error('INVALID_TOTAL_DOSES')
  }

  const rawDoses = event.doses || []
  if (rawDoses.length !== totalDoses) throw new Error('INVALID_VACCINE_DOSES')
  const doses = rawDoses
    .map((dose) => {
      const doseNumber = Number(dose.doseNumber)
      if (!Number.isInteger(doseNumber) || doseNumber < 1 || doseNumber > totalDoses) {
        throw new Error('INVALID_DOSE_NUMBER')
      }
      const paymentType = dose.paymentType === 'self_paid' ? 'self_paid' : 'free'
      const selfPaidVaccineNote = text(dose.selfPaidVaccineNote, 50)
      return {
        doseNumber,
        plannedDate: dateValue(dose.plannedDate),
        paymentType,
        selfPaidVaccineNote: paymentType === 'self_paid' ? selfPaidVaccineNote : '',
        institution: text(dose.institution, 80),
      }
    })
    .sort((left, right) => left.doseNumber - right.doseNumber)

  doses.forEach((dose, index) => {
    if (dose.doseNumber !== index + 1) throw new Error('VACCINE_DOSES_NOT_CONTINUOUS')
    if (!index) return
    const previous = doses[index - 1]
    const minimumDays = Number((catalog.doseIntervals || [])[dose.doseNumber - 1] || 0)
    const difference = Math.floor(
      (dose.plannedDate.getTime() - previous.plannedDate.getTime()) / 86400000,
    )
    if (difference < minimumDays) throw new Error('VACCINE_INTERVAL_INVALID')
  })

  const existingSeries = await db
    .collection('vaccine_series')
    .where({ familyId, childId, catalogId })
    .limit(1)
    .get()
  if (existingSeries.data[0]) throw new Error('VACCINE_SERIES_EXISTS')

  const existingDoses = await db
    .collection('vaccines')
    .where({ familyId, childId, catalogId })
    .limit(1)
    .get()
  if (existingDoses.data[0]) throw new Error('VACCINE_SERIES_EXISTS')

  const timestamp = now()
  const series = await db.collection('vaccine_series').add({
    data: {
      familyId,
      childId,
      catalogId,
      vaccineName: String(catalog.name),
      totalDoses,
      createdBy: member.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  })
  const seriesId = series._id

  const vaccineIds: string[] = []
  try {
    for (const dose of doses) {
      const created = await db.collection('vaccines').add({
        data: {
          familyId,
          childId,
          catalogId,
          seriesId,
          totalDoses,
          name: String(catalog.name),
          ...dose,
          status: 'planned',
          reminderEnabled: true,
          reminderDaysBefore: 7,
          createdBy: member.userId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      })
      vaccineIds.push(created._id)
    }
    return result({ seriesId, id: series._id, vaccineIds })
  } catch (error) {
    await Promise.all(vaccineIds.map((id) => db.collection('vaccines').doc(id).remove()))
    await db.collection('vaccine_series').doc(series._id).remove()
    throw error
  }
}
