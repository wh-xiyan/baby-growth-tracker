import { useCallback, useEffect, useRef, useState } from 'react'
import { listDailyRecords, type DailyRecord } from '../../../services/records'

export function useDailyRecords({
  familyId,
  childId,
  initialized,
  startDate,
  endDate,
}: {
  familyId?: string
  childId?: string
  initialized: boolean
  startDate: string
  endDate: string
}) {
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const sequence = useRef(0)
  const reload = useCallback(async () => {
    const request = ++sequence.current
    if (!initialized) return
    setRecords([])
    setError(false)
    if (!familyId || !childId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await listDailyRecords({ familyId, childId, startDate, endDate })
      if (request === sequence.current) setRecords(data)
    } catch (reason) {
      console.error('加载照护记录失败', reason)
      if (request === sequence.current) setError(true)
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [childId, startDate, endDate, familyId, initialized])
  useEffect(() => {
    void reload()
    return () => {
      sequence.current += 1
    }
  }, [reload])
  return { records, loading, error, reload }
}
