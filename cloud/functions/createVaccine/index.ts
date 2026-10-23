import { activeMember, context, db, now, result } from '../../shared/db'

const boundedText = (value: unknown, maxLength: number) => {
  const content = String(value || '').trim()
  if (content.length > maxLength) throw new Error('TEXT_TOO_LONG')
  return content
}

export async function main(event: Record<string, unknown>) {
  const familyId = String(event.familyId || '')
  const childId = String(event.childId || '')
  const catalogId = String(event.catalogId || '')
  const doseNumber = Number(event.doseNumber)
  const member = await activeMember(familyId, context(), true)
  if (member.role === 'viewer') throw new Error('FORBIDDEN')
  if (!childId || !catalogId || !event.plannedDate) throw new Error('INVALID_VACCINE')
  if (!Number.isInteger(doseNumber) || doseNumber < 1) throw new Error('VACCINE_DOSE_REQUIRED')

  const plannedDate = new Date(String(event.plannedDate))
  if (Number.isNaN(plannedDate.getTime())) throw new Error('INVALID_PLANNED_DATE')
  const child = await db.collection('children').where({ _id: childId, familyId }).limit(1).get()
  if (!child.data[0]) throw new Error('CHILD_NOT_FOUND')

  const catalogResult = await db.collection('vaccine_catalog').doc(catalogId).get()
  const catalog = catalogResult.data as Record<string, any> | undefined
  if (!catalog?.active) throw new Error('INVALID_VACCINE_CATALOG')
  const maxDoses = Number(catalog.maxDoses || catalog.defaultDoses || 1)
  if (doseNumber > maxDoses) throw new Error('INVALID_DOSE_NUMBER')

  const existing = await db.collection('vaccines').where({ familyId, childId, catalogId }).get()
  const records = existing.data as Array<Record<string, any>>
  if (records.some((item) => Number(item.doseNumber) === doseNumber)) {
    throw new Error('VACCINE_DOSE_DUPLICATED')
  }
  const previous = records.find((item) => Number(item.doseNumber) === doseNumber - 1)
  const next = records.find((item) => Number(item.doseNumber) === doseNumber + 1)
  if (previous) {
    const previousDate = new Date(previous.completedDate || previous.plannedDate)
    const interval = Number((catalog.doseIntervals || [])[doseNumber - 1] || 0)
    if (plannedDate.getTime() - previousDate.getTime() < interval * 86400000) {
      throw new Error('VACCINE_INTERVAL_INVALID')
    }
  }
  if (next && plannedDate.getTime() > new Date(next.plannedDate).getTime()) {
    throw new Error('VACCINE_DATE_INVALID')
  }

  const paymentType = event.paymentType === 'self_paid' ? 'self_paid' : 'free'
  const selfPaidVaccineNote = boundedText(event.selfPaidVaccineNote, 50)
  const timestamp = now()
  const existingSeries = await db
    .collection('vaccine_series')
    .where({ familyId, childId, catalogId })
    .limit(1)
    .get()
  const totalDoses = Number(catalog.defaultDoses || maxDoses)
  let seriesId = String(existingSeries.data[0]?._id || '')
  if (!seriesId) {
    const createdSeries = await db.collection('vaccine_series').add({
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
    seriesId = createdSeries._id
  }

  const created = await db.collection('vaccines').add({
    data: {
      familyId,
      childId,
      name: catalog.name,
      catalogId,
      seriesId,
      totalDoses: Number(existingSeries.data[0]?.totalDoses || totalDoses),
      doseNumber,
      plannedDate,
      status: 'planned',
      paymentType,
      selfPaidVaccineNote: paymentType === 'self_paid' ? selfPaidVaccineNote : '',
      institution: boundedText(event.institution, 80),
      reminderEnabled: event.reminderEnabled !== false,
      reminderDaysBefore: event.reminderDaysBefore ? Number(event.reminderDaysBefore) : 7,
      note: boundedText(event.note, 500),
      createdBy: member.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  })
  return result({ id: created._id, seriesId })
}
