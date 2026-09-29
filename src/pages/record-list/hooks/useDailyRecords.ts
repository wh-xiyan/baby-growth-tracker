import { useCallback, useEffect, useState } from 'react'
import { listDailyRecords } from '../../../services/records'
import type { DailyRecord } from '../../../services/records'

export function useDailyRecords({
  familyId,
  childId,
  initialized,
  date,
}: {
  familyId?: string
  childId?: string
  initialized: boolean
  date: string
}) {
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    if (!initialized) return
    if (!familyId || !childId) {
      setRecords([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      setRecords(await listDailyRecords({ familyId, childId, date }))
    } catch (reason) {
      console.error('加载今日记录失败', reason)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [childId, date, familyId, initialized])

  useEffect(() => {
    reload()
  }, [reload])

  return { records, loading, error, reload }
}
