import { useCallback, useEffect, useRef, useState } from 'react'
import { listGrowthRecords, loadGrowthMeasurements } from '../../services/growth'
import type { DailyRecord } from '../../services/records'
import type { GrowthCursor, GrowthQuery, GrowthSummary, GrowthPage } from '../../types/growth'

export function useGrowthData(query: GrowthQuery | undefined) {
  const key = JSON.stringify(query || null),
    sequence = useRef(0),
    busy = useRef(false)
  const [data, setData] = useState<{
    key: string
    items: DailyRecord[]
    summary: GrowthSummary
    cursor?: GrowthCursor
  }>({ key: '', items: [], summary: {} })
  const dataRef = useRef(data)
  dataRef.current = data
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false),
    [moreError, setMoreError] = useState(false)
  const reload = useCallback(async () => {
    const request = ++sequence.current,
      input = JSON.parse(key) as GrowthQuery | undefined
    setLoading(true)
    setError(false)
    setMoreError(false)
    setLoadingMore(false)
    busy.current = false
    if (!input) {
      setData({ key, items: [], summary: {} })
      setLoading(false)
      return
    }
    try {
      let page: GrowthPage =
        input.workspace === 'measurement'
          ? await loadGrowthMeasurements(input)
          : await listGrowthRecords(input)
      if (input.workspace === 'events') {
        const desired = dataRef.current.key === key ? dataRef.current.items.length : 0
        const items = [...page.items]
        while (page.nextCursor && items.length < desired && request === sequence.current) {
          page = await listGrowthRecords({ ...input, cursor: page.nextCursor })
          items.push(...page.items)
        }
        page = { ...page, items: [...new Map(items.map((item) => [item.id, item])).values()] }
      }
      if (request === sequence.current)
        setData({ key, items: page.items, summary: page.summary, cursor: page.nextCursor })
    } catch (cause) {
      console.error('加载成长档案失败', cause)
      if (request === sequence.current) {
        setError(true)
        setData({ key, items: [], summary: {} })
      }
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [key])
  useEffect(() => {
    const activeSequence = sequence
    void reload()
    return () => {
      activeSequence.current++
    }
  }, [reload])
  const loadMore = async () => {
    if (!query || !data.cursor || busy.current || loading || data.key !== key) return
    const request = sequence.current
    busy.current = true
    setLoadingMore(true)
    setMoreError(false)
    try {
      const page = await listGrowthRecords({ ...query, cursor: data.cursor })
      if (request === sequence.current)
        setData((current) => ({
          ...current,
          items: [...new Map([...current.items, ...page.items].map((r) => [r.id, r])).values()],
          cursor: page.nextCursor,
        }))
    } catch (cause) {
      console.error('加载更多成长事件失败', cause)
      if (request === sequence.current) setMoreError(true)
    } finally {
      if (request === sequence.current) {
        busy.current = false
        setLoadingMore(false)
      }
    }
  }
  const ready = data.key === key
  return {
    records: ready ? data.items : [],
    summary: ready ? data.summary : {},
    hasMore: ready && Boolean(data.cursor),
    loading: loading || !ready,
    error: ready && error,
    reload,
    loadMore,
    loadingMore,
    moreError,
  }
}
